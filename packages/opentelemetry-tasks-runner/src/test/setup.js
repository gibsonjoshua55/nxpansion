const { NodeSDK } = require('@opentelemetry/sdk-node');
const {
  InMemorySpanExporter,
  BatchSpanProcessor,
} = require('@opentelemetry/sdk-trace-base');
const { hrTimeToMicroseconds } = require('@opentelemetry/core');
const { writeFile } = require('fs').promises;
const { join } = require('path');

/**
 * On shutdown, writes spans to a json file in the tmp directory
 */
class JsonFileExporter extends InMemorySpanExporter {
  async shutdown() {
    const spans = this.getFinishedSpans();
    const processedSpans = spans.map((span) => {
      /**
       * See opentelemetry-js/blob/main/packages/opentelemetry-sdk-trace-base/src/export/ConsoleSpanExporter.ts
       */
      return {
        traceId: span.spanContext().traceId,
        parentId: span.parentSpanId,
        name: span.name,
        id: span.spanContext().spanId,
        kind: span.kind,
        timestamp: hrTimeToMicroseconds(span.startTime),
        duration: hrTimeToMicroseconds(span.duration),
        attributes: span.attributes,
        status: span.status,
        events: span.events,
      };
    });
    await writeFile(
      join(__dirname, 'tmp/spans.json'),
      JSON.stringify(processedSpans)
    );
    await super.shutdown();
  }
}

const getOtelNodeSdkConfiguration = (defaultConfiguration) => {
  const exporter = new JsonFileExporter();

  const sdk = new NodeSDK({
    ...defaultConfiguration,
    spanProcessor: new BatchSpanProcessor(exporter),
  });
  return { sdk };
};

module.exports = getOtelNodeSdkConfiguration;
