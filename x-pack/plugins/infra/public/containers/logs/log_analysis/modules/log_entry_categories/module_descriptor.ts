/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { i18n } from '@kbn/i18n';
import type { HttpSetup } from 'src/core/public';
import {
  bucketSpan,
  categoriesMessageField,
  DatasetFilter,
  getJobId,
  LogEntryCategoriesJobType,
  logEntryCategoriesJobTypes,
  partitionField,
} from '../../../../../../common/log_analysis';
import { callJobsSummaryAPI } from '../../api/ml_get_jobs_summary_api';
import { callGetMlModuleAPI } from '../../api/ml_get_module';
import { callSetupMlModuleAPI } from '../../api/ml_setup_module_api';
import { callValidateDatasetsAPI } from '../../api/validate_datasets';
import { callValidateIndicesAPI } from '../../api/validate_indices';
import { cleanUpJobsAndDatafeeds } from '../../log_analysis_cleanup';
import { ModuleDescriptor, ModuleSourceConfiguration } from '../../log_analysis_module_types';

const moduleId = 'logs_ui_categories';
const moduleName = i18n.translate('xpack.infra.logs.analysis.logEntryCategoriesModuleName', {
  defaultMessage: 'Categorization',
});
const moduleDescription = i18n.translate(
  'xpack.infra.logs.analysis.logEntryCategoriesModuleDescription',
  {
    defaultMessage: 'Use Machine Learning to automatically categorize log messages.',
  }
);

const getJobIds = (spaceId: string, sourceId: string) =>
  logEntryCategoriesJobTypes.reduce(
    (accumulatedJobIds, jobType) => ({
      ...accumulatedJobIds,
      [jobType]: getJobId(spaceId, sourceId, jobType),
    }),
    {} as Record<LogEntryCategoriesJobType, string>
  );

const getJobSummary = async (spaceId: string, sourceId: string, fetch: HttpSetup['fetch']) => {
  const response = await callJobsSummaryAPI(
    { spaceId, sourceId, jobTypes: logEntryCategoriesJobTypes },
    fetch
  );
  const jobIds = Object.values(getJobIds(spaceId, sourceId));

  return response.filter((jobSummary) => jobIds.includes(jobSummary.id));
};

const getModuleDefinition = async (fetch: HttpSetup['fetch']) => {
  return await callGetMlModuleAPI(moduleId, fetch);
};

const setUpModule = async (
  start: number | undefined,
  end: number | undefined,
  datasetFilter: DatasetFilter,
  { spaceId, sourceId, indices, timestampField }: ModuleSourceConfiguration,
  fetch: HttpSetup['fetch']
) => {
  const indexNamePattern = indices.join(',');
  const jobOverrides = [
    {
      job_id: 'log-entry-categories-count' as const,
      analysis_config: {
        bucket_span: `${bucketSpan}ms`,
      },
      data_description: {
        time_field: timestampField,
      },
      custom_settings: {
        logs_source_config: {
          indexPattern: indexNamePattern,
          timestampField,
          bucketSpan,
          datasetFilter,
        },
      },
    },
  ];
  const query = {
    bool: {
      filter: [
        ...(datasetFilter.type === 'includeSome'
          ? [
              {
                terms: {
                  'event.dataset': datasetFilter.datasets,
                },
              },
            ]
          : []),
        {
          exists: {
            field: 'message',
          },
        },
      ],
    },
  };

  return callSetupMlModuleAPI(
    {
      moduleId,
      start,
      end,
      spaceId,
      sourceId,
      indexPattern: indexNamePattern,
      jobOverrides,
      query,
    },
    fetch
  );
};

const cleanUpModule = async (spaceId: string, sourceId: string) => {
  return await cleanUpJobsAndDatafeeds(spaceId, sourceId, logEntryCategoriesJobTypes);
};

const validateSetupIndices = async (
  indices: string[],
  timestampField: string,
  fetch: HttpSetup['fetch']
) => {
  return await callValidateIndicesAPI(
    {
      indices,
      fields: [
        {
          name: timestampField,
          validTypes: ['date'],
        },
        {
          name: partitionField,
          validTypes: ['keyword'],
        },
        {
          name: categoriesMessageField,
          validTypes: ['text'],
        },
      ],
    },
    fetch
  );
};

const validateSetupDatasets = async (
  indices: string[],
  timestampField: string,
  startTime: number,
  endTime: number,
  fetch: HttpSetup['fetch']
) => {
  return await callValidateDatasetsAPI({ indices, timestampField, startTime, endTime }, fetch);
};

export const logEntryCategoriesModule: ModuleDescriptor<LogEntryCategoriesJobType> = {
  moduleId,
  moduleName,
  moduleDescription,
  jobTypes: logEntryCategoriesJobTypes,
  bucketSpan,
  getJobIds,
  getJobSummary,
  getModuleDefinition,
  setUpModule,
  cleanUpModule,
  validateSetupDatasets,
  validateSetupIndices,
};
