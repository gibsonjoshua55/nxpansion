const { credentials, Metadata } = require('@grpc/grpc-js');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');

const getOtelNodeSdkConfiguration = (defaultConfiguration) => {
  const metadata = new Metadata();
  metadata.set('x-honeycomb-team', process.env.HONEYCOMB_WRITEKEY);
  metadata.set('x-honeycomb-dataset', 'opentelemetry-tasks-runner');
  const traceExporter = new OTLPTraceExporter({
    url: 'grpc://api.honeycomb.io:443/',
    credentials: credentials.createSsl(),
    metadata,
  });
  const spanProcessor = new BatchSpanProcessor(traceExporter);

  defaultConfiguration.traceExporter = traceExporter;
  defaultConfiguration.spanProcessor = spanProcessor;

  const sdk = new NodeSDK(defaultConfiguration);

  return { sdk };
};

module.exports = getOtelNodeSdkConfiguration;
