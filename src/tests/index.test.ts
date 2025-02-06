import * as core from '@actions/core';
import { HttpClient } from '@actions/http-client';
import run from '../index';

// Mock the core and http-client modules
jest.mock('@actions/core');
jest.mock('@actions/http-client');

describe('wt-tools-load-secrets action', () => {
  const mockGetInput = core.getInput as jest.MockedFunction<typeof core.getInput>;
  const mockExportVariable = core.exportVariable as jest.MockedFunction<typeof core.exportVariable>;
  const mockSetOutput = core.setOutput as jest.MockedFunction<typeof core.setOutput>;
  const mockSetFailed = core.setFailed as jest.MockedFunction<typeof core.setFailed>;
  const mockInfo = core.info as jest.MockedFunction<typeof core.info>;

  // Mock HttpClient constructor and its methods
  const mockGetJson = jest.fn();
  (HttpClient as jest.Mock).mockImplementation(() => ({
    getJson: mockGetJson
  }));

  // Helper function to get default input values
  const getDefaultInputValue = (name: string): string => {
    switch (name) {
      case 'apikey':
        return 'test-api-key';
      case 'apisecret':
        return 'test-api-secret';
      case 'project':
        return 'test-project';
      case 'environment':
        return 'test-env';
      case 'output_env_var_prefix':
        return '';
      case 'outputs_prefix':
        return '';
      case 'upper_case_env_keys':
        return 'false';
      case 'api_base_url':
        return 'https://api.wt.tools';
      case 'presigned_url':
        return '';
      default:
        return '';
    }
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Set up default mock implementation
    mockGetInput.mockImplementation(getDefaultInputValue);
  });

  it('should handle presigned URL', async () => {
    const presignedUrl = 'https://api.wt.tools/v1/secrets/presigned/abc123';
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'presigned_url') return presignedUrl;
      return getDefaultInputValue(name);
    });

    const mockSecrets = { SECRET: 'value' };
    mockGetJson.mockResolvedValueOnce({ result: mockSecrets });

    await run();

    // Verify HTTP client was created without auth
    expect(HttpClient).toHaveBeenCalledWith('wt-tools-action');
    
    // Verify the presigned URL was used
    expect(mockGetJson).toHaveBeenCalledWith(
      presignedUrl,
      expect.any(Object)
    );

    // Verify secrets were set
    expect(mockExportVariable).toHaveBeenCalledWith('SECRET', 'value');
  });

  it('should handle presigned URL with prefixes and uppercase', async () => {
    const presignedUrl = 'https://api.wt.tools/v1/secrets/presigned/abc123';
    mockGetInput.mockImplementation((name: string) => {
      switch (name) {
        case 'presigned_url':
          return presignedUrl;
        case 'output_env_var_prefix':
          return 'PREFIX_';
        case 'upper_case_env_keys':
          return 'true';
        default:
          return getDefaultInputValue(name);
      }
    });

    const mockSecrets = { secret_key: 'value' };
    mockGetJson.mockResolvedValueOnce({ result: mockSecrets });

    await run();

    // Verify secrets were set with prefix and uppercase
    expect(mockExportVariable).toHaveBeenCalledWith('PREFIX_SECRET_KEY', 'value');
  });

  it('should successfully set environment variables from secrets', async () => {
    // Mock successful API response
    const mockSecrets = {
      DB_PASSWORD: 'secret123',
      API_TOKEN: 'token456',
      CONFIG: { key: 'value' }
    };
    mockGetJson.mockResolvedValueOnce({ result: mockSecrets });

    await run();

    // Verify HTTP client was created with correct auth
    expect(HttpClient).toHaveBeenCalledWith('wt-tools-action', expect.arrayContaining([
      expect.objectContaining({ username: 'test-api-key', password: 'test-api-secret' })
    ]));

    // Verify environment variables were set
    expect(mockExportVariable).toHaveBeenCalledWith('DB_PASSWORD', 'secret123');
    expect(mockExportVariable).toHaveBeenCalledWith('API_TOKEN', 'token456');
    expect(mockExportVariable).toHaveBeenCalledWith('CONFIG', '{"key":"value"}');

    // Verify success message
    expect(mockInfo).toHaveBeenCalledWith('Successfully loaded secrets into environment variables');
  });

  it('should handle environment variable prefix', async () => {
    // Override specific input values while keeping defaults for others
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'output_env_var_prefix') return 'PREFIX_';
      return getDefaultInputValue(name);
    });

    const mockSecrets = { SECRET: 'value' };
    mockGetJson.mockResolvedValueOnce({ result: mockSecrets });

    await run();

    expect(mockExportVariable).toHaveBeenCalledWith('PREFIX_SECRET', 'value');
  });

  it('should handle uppercase environment variable keys', async () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'upper_case_env_keys') return 'true';
      return getDefaultInputValue(name);
    });

    const mockSecrets = { secret_key: 'value' };
    mockGetJson.mockResolvedValueOnce({ result: mockSecrets });

    await run();

    expect(mockExportVariable).toHaveBeenCalledWith('SECRET_KEY', 'value');
  });

  it('should set outputs with prefix when specified', async () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'outputs_prefix') return 'output_';
      return getDefaultInputValue(name);
    });

    const mockSecrets = { SECRET: 'value' };
    mockGetJson.mockResolvedValueOnce({ result: mockSecrets });

    await run();

    expect(mockSetOutput).toHaveBeenCalledWith('output_SECRET', 'value');
  });

  it('should handle API errors', async () => {
    const errorMessage = 'API Error';
    mockGetJson.mockRejectedValueOnce(new Error(errorMessage));

    await run();

    expect(mockSetFailed).toHaveBeenCalledWith(`Action failed: ${errorMessage}`);
  });

  it('should handle empty response', async () => {
    mockGetJson.mockResolvedValueOnce({ result: null });

    await run();

    expect(mockSetFailed).toHaveBeenCalledWith('Action failed: No secrets found or invalid response');
  });

  it('should use custom API base URL when provided', async () => {
    const customBaseUrl = 'https://custom.api.example.com';
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'api_base_url') return customBaseUrl;
      return getDefaultInputValue(name);
    });

    const mockSecrets = { SECRET: 'value' };
    mockGetJson.mockResolvedValueOnce({ result: mockSecrets });

    await run();

    expect(mockGetJson).toHaveBeenCalledWith(
      `${customBaseUrl}/v1/secrets/projects/test-project/environment/test-env/json`,
      expect.any(Object)
    );
  });

  it('should handle secrets with different value types', async () => {
    const mockSecrets = {
      STRING: 'string-value',
      NUMBER: 42,
      BOOLEAN: true,
      OBJECT: { nested: 'value' },
      ARRAY: [1, 2, 3],
      NULL: null
    };
    mockGetJson.mockResolvedValueOnce({ result: mockSecrets });

    await run();

    expect(mockExportVariable).toHaveBeenCalledWith('STRING', 'string-value');
    expect(mockExportVariable).toHaveBeenCalledWith('NUMBER', '42');
    expect(mockExportVariable).toHaveBeenCalledWith('BOOLEAN', 'true');
    expect(mockExportVariable).toHaveBeenCalledWith('OBJECT', '{"nested":"value"}');
    expect(mockExportVariable).toHaveBeenCalledWith('ARRAY', '[1,2,3]');
    expect(mockExportVariable).toHaveBeenCalledWith('NULL', 'null');
  });

  

  it('should handle presigned URL with free query parameters', async () => {
    const presignedUrl = 'https://api.test.wt.tools/v1/secrets/teams/test/projects/test/items/example/json?api_key=test_key&free_query_params=key%2Cenv&signature=test_signature';
    mockGetInput.mockImplementation((name: string) => {
      switch (name) {
        case 'presigned_url':
          return presignedUrl;
        case 'environment':
          return 'prod';
        case 'key':
          return 'testkey';
        default:
          return getDefaultInputValue(name);
      }
    });

    const mockSecrets = { SECRET: 'value' };
    mockGetJson.mockResolvedValueOnce({ result: mockSecrets });

    await run();

    // Verify HTTP client was created without auth
    expect(HttpClient).toHaveBeenCalledWith('wt-tools-action');
    
    // Verify the correct URL was constructed with all parameters
    expect(mockGetJson).toHaveBeenCalledWith(
      expect.stringContaining('api_key=test_key'),
      expect.any(Object)
    );
    expect(mockGetJson.mock.calls[0][0]).toEqual(
      expect.stringContaining('env=prod')
    );
    expect(mockGetJson.mock.calls[0][0]).toEqual(
      expect.stringContaining('key=testkey')
    );

    // Verify secrets were set
    expect(mockExportVariable).toHaveBeenCalledWith('SECRET', 'value');
  });

  it('should require environment input when env is in free_query_params', async () => {
    const presignedUrl = 'https://api.test.wt.tools/v1/secrets/test/json?api_key=test_key&free_query_params=env&signature=test_signature';
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'presigned_url') return presignedUrl;
      if (name === 'environment') {
        throw new Error('Input required and not supplied: environment');
      }
      return getDefaultInputValue(name);
    });

    await run();

    // Verify that the action failed due to missing required input
    expect(mockSetFailed).toHaveBeenCalledWith(
      expect.stringContaining('Input required and not supplied: environment')
    );
  });

  // Include all previous tests...
  it('should handle presigned URL', async () => {
    const presignedUrl = 'https://api.wt.tools/v1/secrets/presigned/abc123';
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'presigned_url') return presignedUrl;
      return getDefaultInputValue(name);
    });

    const mockSecrets = { SECRET: 'value' };
    mockGetJson.mockResolvedValueOnce({ result: mockSecrets });

    await run();

    expect(HttpClient).toHaveBeenCalledWith('wt-tools-action');
    expect(mockGetJson).toHaveBeenCalledWith(
      presignedUrl,
      expect.any(Object)
    );
    expect(mockExportVariable).toHaveBeenCalledWith('SECRET', 'value');
  });
});