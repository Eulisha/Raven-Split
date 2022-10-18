const AWS = require('aws-sdk');
const { driver, neo4j } = require('./config/neo4j');
const GraphHandler = require('./graph_handler');
const Graph = require('./graph_model');
const RDS = require('./rds_model');
const pool = require('./config/mysql');

const bestGraphStatus = {
    processing: -1,
    finishedProcessing: 0,
    needProcess: 5,
};
const queueURL = {
    prority: process.env.PRIORITY_SQS_URL,
    normal: process.env.NORMAL_SQS_URL,
};

exports.handler = async (event, context) => {
    console.log(event);
    const id = context.awsRequestId;
    const gid = event.Records[0].body;
    const currSqs = event.Records[0].eventSourceARN;

    var checkParams = {
        QueueUrl: queueURL.prority,
        AttributeNames: ['ApproximateNumberOfMessages'],
    };
    const proritizedMsgNum = sqs.getQueueAttributes(checkParams, (err, data) => {
        if (err) {
            console.log('getPriorityQueu ERROR: ', err);
            throw new Error(err);
        } else {
            console.log('proritized msg: ', data);
            return +data.Attributes.ApproximateNumberOfMessages;
        }
    });
    if (proritizedMsgNum > 0) {
        sqs.sendMessage(params, function (err, data) {
            if (err) {
                console.log('sendMessage ERROR: ', err);
                throw new Error(err);
            } else {
                console.log('sendMessage: ', data);
            }
        });
        return {};
    }

    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const session = driver.session();
    const txc = await session.beginTransaction();

    try {
        const updateBestPathGraph = async (gid) => {
            //確認是否已經正在更新
            const result = await RDS.ifProcessingBestGraph(conn, gid);
            console.log('ifProcessingBestGraph result: ', result);

            if (result.length === 0) {
                console.log('group not exist', result[0]);
                statusCode = 400;
                return;
            }

            if (currSqs === queueURL.normal ? result[0].hasNewData < bestGraphStatus.needProcess : result[0].hasNewData == bestGraphStatus.processing) {
                console.log('not yet need to update or under setting: current value: ', result[0].hasNewData);
                statusCode = 400;
                return;
            }

            //開始進行更新
            await RDS.setProcessingBestGraph(conn, gid, bestGraphStatus.processing);
            const [graph, debtsForUpdate] = await GraphHandler.getBestPath(txc, gid);
            const updateGraph = await Graph.updateBestPath(txc, neo4j.int(gid), debtsForUpdate);

            //完成後更新狀態
            await RDS.setFinishedBestGraph(conn, gid, bestGraphStatus.finishedProcessing);

            await conn.commit();
            await txc.commit();
            statusCode = 200;
        };
        result = await updateBestPathGraph(gid);
    } catch (err) {
        console.error(err);
        await conn.rollback();
        await txc.rollback();
        return err;
    } finally {
        conn.release();
        session.close();
    }
    return {};
};
