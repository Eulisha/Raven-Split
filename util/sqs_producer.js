require('dotenv').config();

// Load the AWS SDK for Node.js
const AWS = require('aws-sdk');

// Set the region
AWS.config.update({ region: process.env.REGION });

const produceSqsJob = async (gid) => {
    try {
        // Create an SQS service object
        var sqs = new AWS.SQS({ apiVersion: process.env.SQS_API_VESION });

        var params = {
            MessageBody: `${gid}`,
            QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/186302034262/bestPathProcessQueue',
        };

        const messageId = await sqs.sendMessage(params, function (err, data) {
            if (err) {
                console.error('0', err);
                throw new Error(err);
            } else {
                console.log('Success', data.MessageId);
                return data.MessageId;
            }
        });
        return messageId;
    } catch (err) {
        console.error('1', err);
        throw new Error(err);
    }
};

module.exports = { produceSqsJob };
