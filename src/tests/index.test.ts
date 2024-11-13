// src/__tests__/index.test.ts
import * as core from '@actions/core';
import * as http from '@actions/http-client';
import { getInputs, fetchConfig, setEnvironmentVariables, run } from '../index';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock the GitHub Actions core and http client
jest.mock('@actions/core');
jest.mock('@actions/http-client');

type MockResponse = {
  message: {
    statusCode: number;
  };
  readBody: () => Promise<string>;
};

describe('JSON to Env Action', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    // Setup core mocks
    (core.getInput as jest.Mock).mockImplementation((name: string): string => {
      const inputs: Record<string, string> = {
        'api_url': 'https://test-api.com',
        'project': 'test-project',
        'environment': 'test',
        'env_prefix': 'PREFIX_',
        'outputs_prefix': 'OUT_',
        'upper_case_env_keys': 'true'
      };
      return inputs[name] || '';
    });

    // Setup other core mocks
    (core.setFailed as jest.Mock).mockImplementation(() => {});
    (core.exportVariable as jest.Mock).mockImplementation(() => {});
    (core.setOutput as jest.Mock).mockImplementation(() => {});
    (core.debug as jest.Mock).mockImplementation(() => {});
    (core.info as jest.Mock).mockImplementation(() => {});

    // Setup HTTP client mock
    const mockResponse: MockResponse = {
      message: {
        statusCode: 200
      },
      readBody: async () => JSON.stringify({
        database_url: 'postgresql://test',
        api_key: 'test-key',
        nested_config: { key: 'value' }
      })
    };

    (http.HttpClient.prototype.get as jest.Mock).mockImplementation(() => Promise.resolve(mockResponse));
  });

  describe('getInputs', () => {
    it('should get all required inputs', async () => {
      const inputs = await getInputs();

      expect(inputs).toEqual({
        apiUrl: 'https://test-api.com',
        project: 'test-project',
        environment: 'test',
        envPrefix: 'PREFIX_',
        outputsPrefix: 'OUT_',
        upperCaseEnvKeys: true
      });
    });

    it('should use default values for optional inputs', async () => {
      (core.getInput as jest.Mock).mockImplementation((name: string): string => {
        const inputs: Record<string, string> = {
          'api_url': 'https://test-api.com',
          'project': 'test-project',
          'environment': 'test'
        };
        return inputs[name] || '';
      });

      const inputs = await getInputs();

      expect(inputs).toEqual({
        apiUrl: 'https://test-api.com',
        project: 'test-project',
        environment: 'test',
        envPrefix: '',
        outputsPrefix: '',
        upperCaseEnvKeys: false
      });
    });

    it('should throw error when required inputs are missing', async () => {
      (core.getInput as jest.Mock).mockImplementation(() => '');
      await expect(getInputs()).rejects.toThrow();
    });
  });

  describe('fetchConfig', () => {
    it('should fetch and parse JSON config', async () => {
      const inputs = {
        apiUrl: 'https://test-api.com',
        project: 'test-project',
        environment: 'test',
        envPrefix: '',
        outputsPrefix: '',
        upperCaseEnvKeys: false
      };

      const config = await fetchConfig(inputs);

      expect(config).toEqual({
        database_url: 'postgresql://test',
        api_key: 'test-key',
        nested_config: { key: 'value' }
      });

      expect(http.HttpClient.prototype.get).toHaveBeenCalled();
    });

    it('should handle HTTP errors', async () => {
      (http.HttpClient.prototype.get as jest.Mock).mockImplementation(() => Promise.resolve({
        message: {
          statusCode: 404
        }
      } as MockResponse));

      const inputs = {
        apiUrl: 'https://test-api.com',
        project: 'test-project',
        environment: 'test',
        envPrefix: '',
        outputsPrefix: '',
        upperCaseEnvKeys: false
      };

      await expect(fetchConfig(inputs)).rejects.toThrow('HTTP error! status: 404');
    });

    it('should handle malformed JSON response', async () => {
      (http.HttpClient.prototype.get as jest.Mock).mockImplementation(() => Promise.resolve({
        message: { statusCode: 200 },
        readBody: async () => 'invalid json'
      } as MockResponse));

      const inputs = {
        apiUrl: 'https://test-api.com',
        project: 'test-project',
        environment: 'test',
        envPrefix: '',
        outputsPrefix: '',
        upperCaseEnvKeys: false
      };

      await expect(fetchConfig(inputs)).rejects.toThrow(SyntaxError);
    });
  });

  describe('setEnvironmentVariables', () => {
    it('should set environment variables and outputs with prefixes', async () => {
      const inputs = {
        apiUrl: 'https://test-api.com',
        project: 'test-project',
        environment: 'test',
        envPrefix: 'PREFIX_',
        outputsPrefix: 'OUT_',
        upperCaseEnvKeys: true
      };

      const data = {
        database_url: 'postgresql://test',
        api_key: 'test-key',
        nested_config: { key: 'value' }
      };

      await setEnvironmentVariables(inputs, data);

      expect(core.exportVariable).toHaveBeenCalledWith(
        'DATABASE_URL',
        'postgresql://test'
      );
      expect(core.exportVariable).toHaveBeenCalledWith(
        'API_KEY',
        'test-key'
      );
      expect(core.exportVariable).toHaveBeenCalledWith(
        'NESTED_CONFIG',
        JSON.stringify({ key: 'value' })
      );

      expect(core.setOutput).toHaveBeenCalledWith(
        'OUT_database_url',
        'postgresql://test'
      );
    });

    it('should handle non-uppercase keys when flag is false', async () => {
      const inputs = {
        apiUrl: 'https://test-api.com',
        project: 'test-project',
        environment: 'test',
        envPrefix: 'prefix_',
        outputsPrefix: 'out_',
        upperCaseEnvKeys: false
      };

      const data = {
        database_url: 'postgresql://test',
        API_KEY: 'test-key'
      };

      await setEnvironmentVariables(inputs, data);

      expect(core.exportVariable).toHaveBeenCalledWith(
        'prefix_database_url',
        'postgresql://test'
      );
      expect(core.exportVariable).toHaveBeenCalledWith(
        'prefix_API_KEY',
        'test-key'
      );
    });

    it('should handle special types of values', async () => {
      const inputs = {
        apiUrl: 'https://test-api.com',
        project: 'test-project',
        environment: 'test',
        envPrefix: '',
        outputsPrefix: '',
        upperCaseEnvKeys: true
      };

      const data = {
        number: 123,
        boolean: true,
        null_value: null,
        array: [1, 2, 3],
        empty_string: ''
      };

      await setEnvironmentVariables(inputs, data);

      expect(core.exportVariable).toHaveBeenCalledWith('NUMBER', '123');
      expect(core.exportVariable).toHaveBeenCalledWith('BOOLEAN', 'true');
      expect(core.exportVariable).toHaveBeenCalledWith('NULL_VALUE', '');
      expect(core.exportVariable).toHaveBeenCalledWith('ARRAY', '[1,2,3]');
      expect(core.exportVariable).toHaveBeenCalledWith('EMPTY_STRING', '');
    });
  });

  describe('run', () => {
    it('should successfully complete the entire workflow', async () => {
      await run();

      expect(core.getInput).toHaveBeenCalledWith('api_url', { required: true });
      expect(core.getInput).toHaveBeenCalledWith('project', { required: true });
      expect(core.getInput).toHaveBeenCalledWith('environment', { required: true });

      expect(http.HttpClient.prototype.get).toHaveBeenCalled();
      expect(core.exportVariable).toHaveBeenCalled();
      expect(core.setOutput).toHaveBeenCalled();
      expect(core.info).toHaveBeenCalledWith('Successfully set all environment variables');
      expect(core.setFailed).not.toHaveBeenCalled();
    });

    it('should handle errors properly', async () => {
      (http.HttpClient.prototype.get as jest.Mock).mockImplementation(() => {
        throw new Error('Network error');
      });

      await run();

      expect(core.setFailed).toHaveBeenCalledWith('Network error');
      expect(core.exportVariable).not.toHaveBeenCalled();
      expect(core.setOutput).not.toHaveBeenCalled();
    });
  });
});