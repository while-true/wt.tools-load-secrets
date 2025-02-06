import * as core from '@actions/core';
import { HttpClient } from '@actions/http-client';
import { BasicCredentialHandler } from '@actions/http-client/lib/auth';

interface SecretResponse {
  secretValue: string;
  [key: string]: any;
}

async function run(): Promise<void> {
  try {
    // Get inputs
    const presignedUrl = core.getInput('presigned_url');
    const envPrefix = core.getInput('env_prefix') || '';
    const outputsPrefix = core.getInput('outputs_prefix') || '';
    const upperCaseEnvKeys = core.getInput('upper_case_env_keys') === 'true';

    let http: HttpClient;
    let url: string;

    if (presignedUrl) {
      // For presigned URL, create client without auth
      http = new HttpClient('wt-tools-action');
      url = presignedUrl;
    } else {
      // Traditional auth method
      const apiKey = core.getInput('apikey', { required: true });
      const apiSecret = core.getInput('apisecret', { required: true });
      const project = core.getInput('project', { required: true });
      const environment = core.getInput('environment', { required: true });
      const apiBaseUrl = core.getInput('api_base_url') || 'https://api.wt.tools';

      // Create HTTP client with Basic Auth
      http = new HttpClient('wt-tools-action', [
        new BasicCredentialHandler(apiKey, apiSecret)
      ]);

      // Construct URL for traditional method
      url = `${apiBaseUrl}/v1/secrets/projects/${project}/environment/${environment}/json`;
    }

    // Get project secrets
    const response = await http.getJson<SecretResponse>(url, {
      'Accept': 'application/json'
    });

    if (!response.result) {
      throw new Error('No secrets found or invalid response');
    }

    // Process each secret and set as environment variable
    Object.entries(response.result).forEach(([key, value]) => {
      let envKey = `${envPrefix}${key}`;
      
      // Convert to uppercase if specified
      if (upperCaseEnvKeys) {
        envKey = envKey.toUpperCase();
      }

      // Convert value to string if it's an object/array
      const envValue = typeof value === 'object' 
        ? JSON.stringify(value)
        : String(value);

      // Set environment variable
      core.exportVariable(envKey, envValue);

      // Set output if outputs_prefix is specified
      if (outputsPrefix) {
        const outputKey = `${outputsPrefix}${key}`;
        core.setOutput(outputKey, envValue);
      }
    });

    core.info('Successfully loaded secrets into environment variables');

  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(`Action failed: ${error.message}`);
    } else {
      core.setFailed('An unexpected error occurred');
    }
    // Additional debug logging
    if (process.env.ACTIONS_STEP_DEBUG === 'true') {
      console.error('Error details:', error);
    }
  }
}

run();

export default run;