/**
 * db/dynamodb.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Singleton DynamoDB Document Client.
 *
 * • When DYNAMODB_ENDPOINT is set  → connects to DynamoDB Local (Docker)
 * • When DYNAMODB_ENDPOINT is unset → connects to real AWS DynamoDB
 *
 * The DocumentClient handles marshalling/unmarshalling of JS types to/from
 * DynamoDB's AttributeValue format automatically.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

const clientConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
};

if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_ACCESS_KEY_ID !== 'local') {
  clientConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
} else if (process.env.NODE_ENV !== 'production') {
  clientConfig.credentials = {
    accessKeyId: 'local',
    secretAccessKey: 'local',
  };
}

// When DYNAMODB_ENDPOINT is set, override the endpoint (DynamoDB Local)
if (process.env.DYNAMODB_ENDPOINT) {
  clientConfig.endpoint = process.env.DYNAMODB_ENDPOINT;
}

const rawClient = new DynamoDBClient(clientConfig);

// DocumentClient with sensible marshalling options
const docClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: {
    // Remove undefined values from objects (mimics Mongoose behaviour)
    removeUndefinedValues: true,
    // Convert empty strings to null so DynamoDB accepts them
    convertEmptyValues: false,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

module.exports = { docClient, rawClient };
