/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { ServerFacade, Logger } from '../../../types';
import { HeadlessChromiumDriverFactory } from '../../browsers/chromium/driver_factory';
import { validateBrowser } from './validate_browser';
import { validateConfig } from './validate_config';
import { validateMaxContentLength } from './validate_max_content_length';

export async function runValidations(
  server: ServerFacade,
  logger: Logger,
  browserFactory: HeadlessChromiumDriverFactory
) {
  try {
    await Promise.all([
      validateBrowser(server, browserFactory, logger),
      validateConfig(server, logger),
      validateMaxContentLength(server, logger),
    ]);
    logger.debug(`Reporting plugin self-check ok!`);
  } catch (err) {
    logger.warning(
      `Reporting plugin self-check failed. Please check the Kibana Reporting settings. ${err}`
    );
  }
}
