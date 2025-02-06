# wt.tools-load-secrets Action

This action fetches secrets from wt.tools and loads them into your GitHub Actions environment variables.

## Basic Usage

### Using API Key Authentication

```yaml
name: Deploy Application
on: [push]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Load Secrets
        uses: while-true/wt-tools-load-secrets@v1
        with:
          apikey: ${{ secrets.WT_TOOLS_API_KEY }}
          apisecret: ${{ secrets.WT_TOOLS_API_SECRET }}
          project: 'my-project'
          environment: 'production'

      # Use the loaded secrets in subsequent steps
      - name: Deploy
        run: |
          echo "Using database URL: $DATABASE_URL"
          echo "Using API key: $API_KEY"
```

### Using Presigned URL

```yaml
name: Deploy Application
on: [push]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Load Secrets
        uses: while-true/wt-tools-load-secrets@v1
        with:
          presigned_url: ${{ secrets.WT_TOOLS_PRESIGNED_URL }}
          env_prefix: 'WT_'  # Optional prefix

      # Use the loaded secrets in subsequent steps
      - name: Deploy
        run: |
          echo "Using database URL: $WT_DATABASE_URL"
          echo "Using API key: $WT_API_KEY"
```

## Advanced Usage Examples

### Adding Prefix to Environment Variables

```yaml
- name: Load Secrets with Prefix
  uses: while-true/wt-tools-load-secrets@v1
  with:
    apikey: ${{ secrets.WT_TOOLS_API_KEY }}
    apisecret: ${{ secrets.WT_TOOLS_API_SECRET }}
    project: 'my-project'
    environment: 'staging'
    env_prefix: 'WT_'  # Will prefix all variables with WT_
```

### Using Uppercase Keys

```yaml
- name: Load Secrets with Uppercase
  uses: while-true/wt-tools-load-secrets@v1
  with:
    apikey: ${{ secrets.WT_TOOLS_API_KEY }}
    apisecret: ${{ secrets.WT_TOOLS_API_SECRET }}
    project: 'my-project'
    environment: 'development'
    upper_case_env_keys: true  # Convert all keys to uppercase
```

### Setting Output Variables

```yaml
- name: Load Secrets with Outputs
  id: secrets
  uses: while-true/wt-tools-load-secrets@v1
  with:
    apikey: ${{ secrets.WT_TOOLS_API_KEY }}
    apisecret: ${{ secrets.WT_TOOLS_API_SECRET }}
    project: 'my-project'
    environment: 'production'
    outputs_prefix: 'secret_'  # Will be available as steps.secrets.outputs.secret_*

- name: Use Outputs
  run: echo "The secret value is ${{ steps.secrets.outputs.secret_MY_SECRET }}"
```

### Custom API Endpoint

```yaml
- name: Load Secrets from Custom Endpoint
  uses: while-true/wt-tools-load-secrets@v1
  with:
    apikey: ${{ secrets.WT_TOOLS_API_KEY }}
    apisecret: ${{ secrets.WT_TOOLS_API_SECRET }}
    project: 'my-project'
    environment: 'production'
    api_base_url: 'https://custom.wt.tools'  # Use custom API endpoint
```

### Complete Example with All Options

```yaml
name: Full Deployment Pipeline
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Load Production Secrets
        id: prod-secrets
        uses: while-true/wt-tools-load-secrets@v1
        with:
          apikey: ${{ secrets.WT_TOOLS_API_KEY }}
          apisecret: ${{ secrets.WT_TOOLS_API_SECRET }}
          project: 'my-project'
          environment: 'production'
          env_prefix: 'PROD_'
          outputs_prefix: 'secret_'
          upper_case_env_keys: true
          api_base_url: 'https://api.wt.tools'

      - name: Build Application
        run: |
          echo "Using database URL: $PROD_DATABASE_URL"
          echo "Using API key from output: ${{ steps.prod-secrets.outputs.secret_API_KEY }}"

      - name: Deploy
        env:
          DB_URL: ${{ steps.prod-secrets.outputs.secret_DATABASE_URL }}
        run: ./deploy.sh
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `apikey` | Yes | - | wt.tools API key |
| `apisecret` | Yes | - | wt.tools API secret |
| `project` | Yes | - | Project identifier |
| `environment` | Yes | - | Environment name |
| `env_prefix` | No | '' | Prefix for environment variables |
| `outputs_prefix` | No | '' | Prefix for output variables |
| `upper_case_env_keys` | No | false | Convert keys to uppercase |
| `api_base_url` | No | 'https://api.wt.tools' | Custom API endpoint |

## Security Considerations

1. Always store your API key and secret as GitHub Secrets
2. Use environment-specific secrets when possible
3. Consider using the env_prefix to avoid variable name conflicts
4. Regularly rotate your API credentials

## Troubleshooting

If you encounter issues:

1. Check your API credentials
2. Verify the project and environment names
3. Enable debug logging by setting the secret `ACTIONS_STEP_DEBUG` to true
4. Check the action logs for detailed error messages