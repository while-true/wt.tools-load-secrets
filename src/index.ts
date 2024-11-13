// src/index.ts
import * as core from '@actions/core';
import * as http from '@actions/http-client';

interface ActionInputs {
  apiUrl: string;
  project: string;
  environment: string;
  envPrefix: string;
  outputsPrefix: string;
  upperCaseEnvKeys: boolean;
}

export async function getInputs(): Promise<ActionInputs> {
  return {
    apiUrl: core.getInput('api_url', { required: true }),
    project: core.getInput('project', { required: true }),
    environment: core.getInput('environment', { required: true }),
    envPrefix: core.getInput('env_prefix') || '',
    outputsPrefix: core.getInput('outputs_prefix') || '',
    upperCaseEnvKeys: core.getInput('upper_case_env_keys') === 'true',
  };
}

export async function fetchConfig(inputs: ActionInputs): Promise<Record<string, unknown>> {
  const client = new http.HttpClient('json-to-env-action');
  const url = `${inputs.apiUrl}?project=${encodeURIComponent(inputs.project)}&env=${encodeURIComponent(inputs.environment)}`;
  
  const response = await client.get(url);
  
  if (response.message.statusCode !== 200) {
    throw new Error(`HTTP error! status: ${response.message.statusCode}`);
  }
  
  const body = await response.readBody();
  return JSON.parse(body);
}



export async function setEnvironmentVariables(inputs: ActionInputs, data: Record<string, unknown>): Promise<void> {
  for (const [key, value] of Object.entries(data)) {
    
    const envValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    
    let outputKey = inputs.outputsPrefix + key;
    let envKey = inputs.envPrefix + key;
    if (inputs.upperCaseEnvKeys) {
      envKey = key.toUpperCase();
    }
    core.exportVariable(envKey, envValue);
    core.debug(`ENV: Set ${envKey}=${envValue}`);
    core.setOutput(outputKey, envValue);
    core.debug(`Output: Set ${outputKey}=${envValue}`);
  }
}

export async function run(): Promise<void> {
  try {
    const inputs = await getInputs();
    const config = await fetchConfig(inputs);
    await setEnvironmentVariables(inputs, config);
    
    core.info('Successfully set all environment variables');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}

run();