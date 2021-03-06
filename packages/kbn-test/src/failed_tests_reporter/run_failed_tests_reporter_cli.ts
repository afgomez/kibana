/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { REPO_ROOT, run, createFailError, createFlagError } from '@kbn/dev-utils';
import globby from 'globby';

import { getFailures } from './get_failures';
import { GithubApi } from './github_api';
import { updateFailureIssue, createFailureIssue } from './report_failure';
import { getIssueMetadata } from './issue_metadata';
import { readTestReport } from './test_report';
import { addMessagesToReport, Message } from './add_messages_to_report';

export function runFailedTestsReporterCli() {
  run(
    async ({ log, flags }) => {
      let updateGithub = flags['github-update'];
      if (updateGithub && !process.env.GITHUB_TOKEN) {
        throw createFailError(
          'GITHUB_TOKEN environment variable must be set, otherwise use --no-github-update flag'
        );
      }

      if (updateGithub) {
        // JOB_NAME is formatted as `elastic+kibana+7.x` in some places and `elastic+kibana+7.x/JOB=kibana-intake,node=immutable` in others
        const jobNameSplit = (process.env.JOB_NAME || '').split(/\+|\//);
        const branch = jobNameSplit.length >= 3 ? jobNameSplit[2] : process.env.GIT_BRANCH;
        if (!branch) {
          throw createFailError(
            'Unable to determine originating branch from job name or other environment variables'
          );
        }

        const isPr = !!process.env.ghprbPullId;
        const isMasterOrVersion =
          branch.match(/^(origin\/){0,1}master$/) || branch.match(/^(origin\/){0,1}\d+\.(x|\d+)$/);
        if (!isMasterOrVersion || isPr) {
          log.info('Failure issues only created on master/version branch jobs');
          updateGithub = false;
        }
      }

      const githubApi = new GithubApi({
        log,
        token: process.env.GITHUB_TOKEN,
        dryRun: !updateGithub,
      });

      const buildUrl = flags['build-url'] || (updateGithub ? '' : 'http://buildUrl');
      if (typeof buildUrl !== 'string' || !buildUrl) {
        throw createFlagError('Missing --build-url or process.env.BUILD_URL');
      }

      const reportPaths = await globby(['target/junit/**/*.xml'], {
        cwd: REPO_ROOT,
        absolute: true,
      });

      for (const reportPath of reportPaths) {
        const report = await readTestReport(reportPath);
        const messages: Message[] = [];

        for (const failure of await getFailures(report)) {
          if (failure.likelyIrrelevant) {
            messages.push({
              classname: failure.classname,
              name: failure.name,
              message:
                'Failure is likely irrelevant' +
                (updateGithub ? ', so an issue was not created or updated' : ''),
            });
            continue;
          }

          const existingIssue = await githubApi.findFailedTestIssue(
            i =>
              getIssueMetadata(i.body, 'test.class') === failure.classname &&
              getIssueMetadata(i.body, 'test.name') === failure.name
          );

          if (existingIssue) {
            const newFailureCount = await updateFailureIssue(buildUrl, existingIssue, githubApi);
            const url = existingIssue.html_url;
            const message =
              `Test has failed ${newFailureCount - 1} times on tracked branches: ${url}` +
              (updateGithub
                ? `. Updated existing issue: ${url} (fail count: ${newFailureCount})`
                : '');

            messages.push({
              classname: failure.classname,
              name: failure.name,
              message,
            });
            continue;
          }

          const newIssueUrl = await createFailureIssue(buildUrl, failure, githubApi);
          const message =
            `Test has not failed recently on tracked branches` +
            (updateGithub ? `Created new issue: ${newIssueUrl}` : '');

          messages.push({
            classname: failure.classname,
            name: failure.name,
            message,
          });
        }

        // mutates report to include messages and writes updated report to disk
        await addMessagesToReport({
          report,
          messages,
          log,
          reportPath,
          dryRun: !flags['report-update'],
        });
      }
    },
    {
      description: `a cli that opens issues or updates existing issues based on junit reports`,
      flags: {
        boolean: ['github-update', 'report-update'],
        string: ['build-url'],
        default: {
          'github-update': true,
          'report-update': true,
          'build-url': process.env.BUILD_URL,
        },
        help: `
          --no-github-update Execute the CLI without writing to Github
          --no-report-update Execute the CLI without writing to the JUnit reports
          --build-url        URL of the failed build, defaults to process.env.BUILD_URL
        `,
      },
    }
  );
}
