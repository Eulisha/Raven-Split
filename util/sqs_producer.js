require('dotenv').config();

// Load the AWS SDK for Node.js
const AWS = require('aws-sdk');

// Set the region
AWS.config.update({ region: process.env.REGION });

const produceSqsJob = async (gid, url) => {
    try {
        // Create an SQS service object
        var sqs = new AWS.SQS({ apiVersion: process.env.SQS_API_VESION });

        var params = {
            MessageBody: `${gid}`,
            QueueUrl: url,
        };

        const messageId = await new Promise((resolve, reject) => {
            sqs.sendMessage(params, function (err, data) {
                if (err) {
                    reject(err);
                } else {
                    resolve(data.MessageId);
                }
            });
        });
        return messageId;
    } catch (err) {
        throw new Error(err);
    }
};

module.exports = { produceSqsJob };
