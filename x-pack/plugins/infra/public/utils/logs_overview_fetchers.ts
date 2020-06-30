/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { SearchParams } from 'elasticsearch';

import {
  InfraClientCoreSetup,
  InfraClientStartDeps,
  StatsAggregation,
  SeriesAggregation,
} from '../types';
import { LogsFetchDataResponse } from '../../../observability/public';

type LogsOverviewStatsAndSeries = Pick<LogsFetchDataResponse, 'stats' | 'series'>;
interface LogsOverviewAggregations {
  stats: StatsAggregation;
  series: SeriesAggregation;
}

export function getLogsHasDataFetcher(getStartServices: InfraClientCoreSetup['getStartServices']) {
  return async () => {
    // if you need the data plugin, this is how you get it
    const [, startPlugins] = await getStartServices();
    const { data } = startPlugins;

    // if you need a core dep, we need to pass in more than just getStartServices

    // perform query
    return true;
  };
}

export function getLogsOverviewDataFetcher(
  getStartServices: InfraClientCoreSetup['getStartServices']
) {
  return async (): Promise<LogsFetchDataResponse> => {
    // if you need the data plugin, this is how you get it
    const [, startPlugins] = await getStartServices();
    const { data } = startPlugins;

    // if you need a core dep, we need to pass in more than just getStartServices

    const { stats, series } = await fetchLogsOverview('now-15m', 'now', data);

    return {
      title: 'Log rate',
      appLink: 'lalal', // TODO: what format should this be in, relative I assume?
      stats,
      series,
    };
  };
}

async function fetchLogsOverview(
  startDate: string,
  endDate: string,
  dataPlugin: InfraClientStartDeps['data']
): Promise<LogsOverviewStatsAndSeries> {
  const esSearcher = dataPlugin.search.getSearchStrategy('es');
  return new Promise((resolve, reject) => {
    esSearcher
      .search({ params: buildLogsOverviewQuery('filebeat-*', startDate, endDate) })
      .subscribe(
        (result) => {
          if (result.rawResponse.aggregations) {
            const processedAggregations = processLogsOverview(
              result.rawResponse.aggregations as LogsOverviewAggregations
            );
            resolve(processedAggregations);
          } else {
            resolve({ stats: {}, series: {} });
          }
        },
        (error: Error) => reject(error)
      );
  });
}

function buildLogsOverviewQuery(index: string, startDate: string, endDate: string): SearchParams {
  return {
    index,
    body: {
      size: 0,
      query: {
        range: {
          '@timestamp': {
            gte: startDate,
            lte: endDate,
            format: 'strict_date_optional_time',
          },
        },
      },
      aggs: {
        stats: {
          terms: {
            field: 'event.dataset',
            size: 4,
          },
        },
        series: {
          date_histogram: {
            field: '@timestamp',
            fixed_interval: '30s',
          },
          aggs: {
            dataset: {
              terms: {
                field: 'event.dataset',
                size: 4,
              },
            },
          },
        },
      },
    },
  };
}

function processLogsOverview({
  stats,
  series,
}: LogsOverviewAggregations): LogsOverviewStatsAndSeries {
  const processedStats = (stats.buckets as any[]).reduce<LogsOverviewStatsAndSeries['stats']>(
    (result, bucket) => {
      result[bucket.key] = {
        type: 'number',
        label: bucket.key,
        value: bucket.doc_count,
      };

      return result;
    },
    {}
  );

  const processedSeries = (series.buckets as any[]).reduce<LogsOverviewStatsAndSeries['series']>(
    (result, bucket) => {
      const x = bucket.key; // the timestamp of the bucket
      bucket.dataset.buckets.forEach((b) => {
        const label = b.key;
        result[label] = result[label] || { label, coordinates: [] };
        result[label].coordinates.push({ x, y: b.doc_count });
      });

      return result;
    },
    {}
  );

  return { stats: processedStats, series: processedSeries };
}
