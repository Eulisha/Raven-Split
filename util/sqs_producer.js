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

        const messageId = await sqs.sendMessage(params, function (err, data) {
            if (err) {
                console.error('SQS ERROR: ', err);
                throw new Error(err);
            } else {
                console.log('Success', data.MessageId);
                return data.MessageId;
            }
        });
        return messageId;
    } catch (err) {
        console.error('SQS ERROR: ', err);
        throw new Error(err);
    }
};

module.exports = { produceSqsJob };
