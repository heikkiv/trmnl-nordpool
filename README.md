# TRMNL Nord Pool Plugin

A self-hosted plugin for [TRMNL](https://trmnl.com) e-ink displays that shows day-ahead electricity prices from [Nord Pool](https://www.nordpoolgroup.com/).

## Features

- Hourly bar chart of today's day-ahead prices
- Current hour highlighted in solid black
- Min / Max / Average / Current price statistics
- All four TRMNL layout sizes (full, half horizontal, half vertical, quadrant)
- Browser preview endpoints for development
- 5-minute price cache to avoid excessive API calls

## Setup

```bash
npm install
npm start
```

The server starts on port 4000 by default.

## Configuration

Set environment variables or create a `.env` file (see `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Server port |
| `NORDPOOL_AREA` | `FI` | Nord Pool delivery area (FI, EE, SE1-SE4, etc.) |
| `NORDPOOL_CURRENCY` | `EUR` | Price currency (EUR, SEK, NOK, DKK) |

## Endpoints

| Path | Description |
|---|---|
| `GET /api/trmnl` | TRMNL webhook — returns JSON with `markup`, `markup_half_horizontal`, `markup_half_vertical`, `markup_quadrant` |
| `GET /preview` | Full-size browser preview |
| `GET /preview/half-horizontal` | Half horizontal preview |
| `GET /preview/half-vertical` | Half vertical preview |
| `GET /preview/quadrant` | Quadrant preview |
| `GET /health` | Health check |

## Connecting to TRMNL

1. In your TRMNL dashboard, create a new **Private Plugin**
2. Set the strategy to **Polling**
3. Set the polling URL to `https://your-server.example.com/api/trmnl`
4. TRMNL will poll this endpoint and render the returned markup on your device
5. Edit plugin markup and add the appropriate markup variable to each view `{{markup}}`, `{{markup_half_horizontal}}` etc... 


## Lambda Deployment

Deploy to AWS Lambda with a Function URL — no API Gateway needed.

### Prerequisites

- AWS CLI configured with appropriate credentials
- An IAM role for Lambda with basic execution permissions

### Deploy

```bash
export LAMBDA_ROLE_ARN=arn:aws:iam::123456789012:role/your-lambda-role
npm run deploy
```

The script will create (or update) a Lambda function named `trmnl-nordpool` in `eu-north-1` and print the Function URL. Set the webhook URL in your TRMNL dashboard to `<function-url>/api/trmnl`.

Configure the area and currency via environment variables before deploying:

```bash
export NORDPOOL_AREA=FI
export NORDPOOL_CURRENCY=EUR
npm run deploy
```

## Development

```bash
npm run dev
```

This starts the server with `--watch` for auto-reload on file changes. Open `http://localhost:4000/preview` in your browser to see the plugin rendered at 800x480px.

## License

MIT
