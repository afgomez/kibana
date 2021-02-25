/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useEffect } from 'react';

import { useValues, useActions } from 'kea';

import {
  EuiPageHeader,
  EuiPageHeaderSection,
  EuiPageContent,
  EuiTitle,
  EuiBasicTable,
  EuiBasicTableColumn,
  EuiEmptyPrompt,
} from '@elastic/eui';
import { i18n } from '@kbn/i18n';

import { FlashMessages } from '../../../../shared/flash_messages';
import { KibanaLogic } from '../../../../shared/kibana';
import { Loading } from '../../../../shared/loading';
import { EuiButtonTo, EuiLinkTo } from '../../../../shared/react_router_helpers';
import { convertMetaToPagination, handlePageChange } from '../../../../shared/table_pagination';

import { ENGINE_CURATIONS_NEW_PATH, ENGINE_CURATION_PATH } from '../../../routes';
import { FormattedDateTime } from '../../../utils/formatted_date_time';
import { generateEnginePath } from '../../engine';

import { CURATIONS_OVERVIEW_TITLE, CREATE_NEW_CURATION_TITLE } from '../constants';
import { CurationsLogic } from '../curations_logic';
import { Curation } from '../types';
import { convertToDate } from '../utils';

export const Curations: React.FC = () => {
  const { dataLoading, curations, meta } = useValues(CurationsLogic);
  const { loadCurations } = useActions(CurationsLogic);

  useEffect(() => {
    loadCurations();
  }, [meta.page.current]);

  if (dataLoading && !curations.length) return <Loading />;

  return (
    <>
      <EuiPageHeader>
        <EuiPageHeaderSection>
          <EuiTitle size="l">
            <h1>{CURATIONS_OVERVIEW_TITLE}</h1>
          </EuiTitle>
        </EuiPageHeaderSection>
        <EuiPageHeaderSection>
          <EuiButtonTo to={generateEnginePath(ENGINE_CURATIONS_NEW_PATH)} fill>
            {CREATE_NEW_CURATION_TITLE}
          </EuiButtonTo>
        </EuiPageHeaderSection>
      </EuiPageHeader>
      <EuiPageContent>
        <FlashMessages />
        <CurationsTable />
      </EuiPageContent>
    </>
  );
};

export const CurationsTable: React.FC = () => {
  const { dataLoading, curations, meta } = useValues(CurationsLogic);
  const { onPaginate, deleteCurationSet } = useActions(CurationsLogic);

  const columns: Array<EuiBasicTableColumn<Curation>> = [
    {
      field: 'queries',
      name: i18n.translate(
        'xpack.enterpriseSearch.appSearch.engine.curations.table.column.queries',
        { defaultMessage: 'Queries' }
      ),
      render: (queries: Curation['queries'], curation: Curation) => (
        <EuiLinkTo
          data-test-subj="CurationsTableQueriesLink"
          to={generateEnginePath(ENGINE_CURATION_PATH, { curationId: curation.id })}
        >
          {queries.join(', ')}
        </EuiLinkTo>
      ),
      width: '40%',
      truncateText: true,
      mobileOptions: {
        header: true,
        // Note: the below props are valid props per https://elastic.github.io/eui/#/tabular-content/tables (Responsive tables), but EUI's types have a bug reporting it as an error
        // @ts-ignore
        enlarge: true,
        width: '100%',
        truncateText: false,
      },
    },
    {
      field: 'last_updated',
      name: i18n.translate(
        'xpack.enterpriseSearch.appSearch.engine.curations.table.column.lastUpdated',
        { defaultMessage: 'Last updated' }
      ),
      width: '30%',
      dataType: 'string',
      render: (dateString: string) => <FormattedDateTime date={convertToDate(dateString)} />,
    },
    {
      width: '120px',
      actions: [
        {
          name: i18n.translate(
            'xpack.enterpriseSearch.appSearch.engine.curations.table.editAction',
            { defaultMessage: 'Edit' }
          ),
          description: i18n.translate(
            'xpack.enterpriseSearch.appSearch.engine.curations.table.editTooltip',
            { defaultMessage: 'Edit curation' }
          ),
          type: 'icon',
          icon: 'pencil',
          color: 'primary',
          onClick: (curation: Curation) => {
            const { navigateToUrl } = KibanaLogic.values;
            const url = generateEnginePath(ENGINE_CURATION_PATH, { curationId: curation.id });
            navigateToUrl(url);
          },
          'data-test-subj': 'CurationsTableEditButton',
        },
        {
          name: i18n.translate(
            'xpack.enterpriseSearch.appSearch.engine.curations.table.deleteAction',
            { defaultMessage: 'Delete' }
          ),
          description: i18n.translate(
            'xpack.enterpriseSearch.appSearch.engine.curations.table.deleteTooltip',
            { defaultMessage: 'Delete curation' }
          ),
          type: 'icon',
          icon: 'trash',
          color: 'danger',
          onClick: (curation: Curation) => deleteCurationSet(curation.id),
          'data-test-subj': 'CurationsTableDeleteButton',
        },
      ],
    },
  ];

  return (
    <EuiBasicTable
      columns={columns}
      items={curations}
      responsive
      hasActions
      loading={dataLoading}
      noItemsMessage={
        <EuiEmptyPrompt
          iconType="pin"
          title={
            <h4>
              {i18n.translate(
                'xpack.enterpriseSearch.appSearch.engine.curations.table.empty.noCurationsTitle',
                { defaultMessage: 'No curations yet' }
              )}
            </h4>
          }
        />
      }
      pagination={{
        ...convertMetaToPagination(meta),
        hidePerPageOptions: true,
      }}
      onChange={handlePageChange(onPaginate)}
    />
  );
};
