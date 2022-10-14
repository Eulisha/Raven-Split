require('dotenv').config();
const Debt = require('../models/debt_model');
const Graph = require('../models/graph_model');
const pool = require('../config/mysql');
const { neo4j, driver } = require('../config/neo4j');
const Admin = require('../models/admin_model');
const pageSize = process.env.PAGE_SIZE;
const Mapping = require('../config/mapping');
const { produceSqsJob } = require('../util/sqs_producer');

const getDebts = async (req, res) => {
    if (req.userGroupRole.gid != Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['viewer']) {
        console.error('@getDebts controller: auth fail, gid: ', req.userGroupRole.gid, req.params.id);
        return res.status(403).json({ err: 'No authorization.' });
    }

    const gid = Number(req.params.id);
    const uid = req.user.id;
    const paging = Number(req.query.paging) - 1 || 0;

    const debtMainRecords = [];
    //撈所有該群組內的帳
    try {
        const [debtMainResult] = await Debt.getDebts(gid, pageSize, paging);
        if (!debtMainResult) {
            console.error('@getDebts controller: getDebts fail: ', debtMainResult);
            return res.status(500).json({ err: 'Internal Server Error' });
        }

        //查借貸明細
        for (let debtMain of debtMainResult) {
            let debtMainId = debtMain.id;
            let ownAmount = 0;
            let isOwned = false;
            let [debtDetailResult] = await Debt.getDebtDetail(debtMainId, uid);

            //自己沒有參與這筆帳
            if (!debtDetailResult) {
                isOwned = null;
                debtDetailResult = {};
                debtDetailResult.amount = 0;
            }
            //自己是付錢的人
            if (uid == debtMain.lender) {
                isOwned = true;
                ownAmount = debtMain.total - debtDetailResult.amount;
            } else {
                ownAmount = debtDetailResult.amount;
            }

            const debtMainRecord = {
                id: debtMain.id,
                gid,
                date: debtMain.date,
                title: debtMain.title,
                total: debtMain.total,
                isOwned,
                lender: debtMain.lender,
                split_method: debtMain.split_method,
                ownAmount,
            };
            debtMainRecords.push(debtMainRecord);
        }

        return res.status(200).json({ data: debtMainRecords });
    } catch (err) {
        console.error('@getDebts controller:', err);
        return res.status(500).json({ err: 'Internal Server Error' });
    }
};
const getDebtDetail = async (req, res) => {
    if (req.userGroupRole.gid != Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['viewer']) {
        console.error('@getDebtDetail controller: auth fail, gid: ', req.userGroupRole.gid, req.params.id);
        return res.status(403).json({ err: 'No authorization.' });
    }
    const debtMainId = req.params.debtId;
    try {
        const result = await Debt.getDebtDetail(debtMainId);
        if (!result) {
            console.error('@getDebtDetail controller: db fail:', result);
            throw new Error('Internal Server Error');
        }
        return res.status(200).json({ data: result });
    } catch (err) {
        console.error('@getDebtDetail: err:', err);
        return res.status(500).json({ err: 'Internal Server Error' });
    }
};
const getDebtPages = async (req, res) => {
    if (req.userGroupRole.gid != Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['viewer']) {
        console.error('@getDebtPages: 403: ', req.userGroupRole.gid, req.params.id, req.id);
        return res.status(403).json({ err: 'No authorization.' });
    }
    const gid = Number(req.params.id);

    try {
        //查paging
        const count = await Debt.getDebtCount(gid);
        if (!count) {
            console.error('@getDebtPages: db getDebtCount fail: ', count);
            return res.status(500).json({ err: 'Internal Server Error' });
        }
        const pageCount = Math.ceil(count[0].count / Number(pageSize));
        return res.status(200).json({ data: { pageCount } });
    } catch (err) {
        console.error('@getDebtPages: err:', err);
        return res.status(500).json({ err: 'Internal Server Error' });
    }
};

const getMeberBalances = async (req, res) => {
    if (req.userGroupRole.gid != Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['viewer']) {
        console.error('@getMeberBalances: 403: ', req.userGroupRole.gid, req.params.id, req.id);
        return res.status(403).json({ err: 'No authorization.' });
    }
    const gid = Number(req.params.id);
    const conn = await pool.getConnection(); //配合其他route要使用get connection

    try {
        const groupUserIds = await Admin.getGroupUserIds(gid);
        if (!groupUserIds) {
            console.error('@getMeberBalances: db getGroupUserIds fail: ', groupUserIds);
            throw new Error('Internal Server Error');
        }

        const balances = await Debt.getAllBalances(conn, gid); //{id, borrower, lender, amount}
        if (!balances) {
            console.error('@getMeberBalances: db getAllBalances fail: ', balances);
            throw new Error('Internal Server Error');
        }

        let balancesGroupByUser = {}; //{uid:{uid:null, balance:null, detail:{borrower:null, lender:null, amount:null}}}
        //把所有成員各自的object建好
        for (let user of groupUserIds) {
            balancesGroupByUser[user.uid] = { uid: user.uid, balance: 0, detail: [] };
        }

        //group by uid
        for (let balance of balances) {
            //存borrower的
            balancesGroupByUser[balance.borrower]['balance'] -= balance.amount;
            balancesGroupByUser[balance.borrower]['detail'].push(balance);
            //存lender的
            balancesGroupByUser[balance.lender]['balance'] += balance.amount;
            balancesGroupByUser[balance.lender]['detail'].push(balance);
        }
        balancesGroupByUser = Object.values(balancesGroupByUser);
        return res.status(200).json({ data: balancesGroupByUser });
    } catch (err) {
        console.error('@getMeberBalances: err:', err);
        return res.status(500).json({ err: 'Internal Server Error' });
    } finally {
        conn.release();
    }
};
const getSettle = async (req, res) => {
    if (req.userGroupRole.gid != Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['viewer']) {
        console.error('@getSettle: 403: ', req.userGroupRole.gid, req.params.id, req.id);
        return res.status(403).json({ err: 'No authorization.' });
    }
    const gid = Number(req.params.id);
    const uid = req.user.id;

    const conn = await pool.getConnection(); //配合其他route共用model, 要使用get connection
    try {
        //check if graph is newest
        let currNewDataAmount = await Admin.getNewDataAmount(conn, gid);
        let processStatus = currNewDataAmount[0].hasNewData;

        //not updated yet
        if (processStatus !== 0) {
            const messgeId = await produceSqsJob(gid, process.env.PRIORITY_SQS_URL);
        }

        //wait for calculate finished
        if (processStatus === -1 || processStatus !== 0) {
            let count = 0;
            async function waitForFinished(conn, gid) {
                return new Promise((resolve, reject) => {
                    const intervalObj = setInterval(
                        async () => {
                            count++;
                            if (count > 8) {
                                resolve(clearInterval(intervalObj));
                            }
                            async function getCurrStatus(conn, gid) {
                                try {
                                    currNewDataAmount = await Admin.getNewDataAmount(conn, gid);
                                    processStatus = currNewDataAmount[0].hasNewData;
                                    if (processStatus == 0) {
                                        resolve(processStatus);
                                        clearInterval(intervalObj);
                                    }
                                } catch (err) {
                                    reject(err);
                                }
                            }
                            await getCurrStatus(conn, gid);
                        },
                        500,
                        conn,
                        gid
                    );
                });
            }
            await waitForFinished(conn, gid);
        }

        conn.release();

        //still not finished after 4s, ask user come back later
        if (processStatus != 0) {
            console.error('@getSettle: 503 waiting for sqs resource: ', processStatus);
            return res.status(503).json({ err: 'Might need some time calculating Best Solution. Please check later.' });
        }

        const session = driver.session();
        await session.readTransaction(async (txc) => {
            const resultGetGraph = await Graph.getGraph(txc, neo4j.int(gid));
            if (!resultGetGraph) {
                console.error('@getSettle: neo4j getGraph fail:', resultGetGraph);
                throw new Error('Internal Server Error');
            }
            const graph = resultGetGraph.records.map((record) => {
                let amount = record.get('amount').toNumber();
                let borrower = record.get('borrower').toNumber();
                let lender = record.get('lender').toNumber();
                return { borrower, lender, amount };
            });

            const resultSetSetting = await Admin.setSettling(gid, uid);
            if (!resultSetSetting) {
                throw new Error('Internal Server Error');
            }

            return res.status(200).json({ data: graph });
        });
    } catch (err) {
        console.error('@getSettle :err: ', err);
        return res.status(500).json({ err: 'Internal Server Error' });
    }
};
const getSettlePair = async (req, res) => {
    if (req.userGroupRole.gid != Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['viewer']) {
        console.error('@getSettlePair: 403: ', req.userGroupRole.gid, req.params.id, req.id);
        return res.status(403).json({ err: 'No authorization.' });
    }
    const gid = Number(req.params.id);
    const uid = req.user.id;

    try {
        const resultSetSetting = await Admin.setSettling(gid, uid);
        if (!resultSetSetting) {
            throw new Error('Internal Server Error');
        }
        return res.status(200).json({ data: null });
    } catch (err) {
        console.error('@getSettlePair: err: ', err);
        return res.status(500).json({ err: 'Internal Server Error' });
    }
};
const getUserBalances = async (req, res) => {
    const uid = req.user.id;

    try {
        const result = await Debt.getUserBalances(uid); //同時撈borrow跟lend
        if (!result) {
            console.error('@getUserBalances, db getUserBalances fail: ', result);
            throw new Error('Internal Server Error');
        }
        let borrow = {};
        let lend = {};
        let data = {};
        let summary = { borrow: 0, lend: 0, net: 0 };

        //borrow: 我跟lender借錢
        if (result[0].length == 0) {
            data.borrow = [];
        } else {
            result[0].map((debt) => {
                summary.borrow += debt.amount;
                if (!borrow[debt.lender]) {
                    borrow[debt.lender] = { uid: debt.lender, user_name: debt.user_name, pair: null, total: null, group_normal: [], group_buying: [] };
                }
                if (Number(debt.type) == Mapping.GROUP_TYPE.pair) {
                    //兩人分帳
                    borrow[debt.lender]['uid'] = debt.lender;
                    borrow[debt.lender]['pair'] = debt.amount;
                    borrow[debt.lender]['total'] += debt.amount;
                } else {
                    borrow[debt.lender]['total'] += debt.amount;
                    group = { gid: debt.gid, group_name: debt.group_name, amount: debt.amount };
                    if (Number(debt.type) == Mapping.GROUP_TYPE.group) {
                        //一般分帳群
                        borrow[debt.lender]['group_normal'].push(group);
                    } else {
                        //團購分帳群
                        borrow[debt.lender]['group_buying'].push(group);
                    }
                }
                data.borrow = Object.values(borrow);
            });
        }

        //lend: 我借borrower錢
        if (result[1].length == 0) {
            data.lend = [];
        } else {
            result[1].map((debt) => {
                summary.lend += debt.amount;
                if (!lend[debt.borrower]) {
                    lend[debt.borrower] = { uid: debt.borrower, user_name: debt.user_name, pair: null, total: null, group_normal: [], group_buying: [] };
                }
                if (Number(debt.type) == Mapping.GROUP_TYPE.pair) {
                    //兩人分帳
                    lend[debt.borrower]['uid'] = debt.borrower;
                    lend[debt.borrower]['pair'] = debt.amount;
                    lend[debt.borrower]['total'] += debt.amount;
                } else {
                    lend[debt.borrower]['total'] += debt.amount;
                    group = { gid: debt.gid, group_name: debt.group_name, amount: debt.amount };
                    if (Number(debt.type) == Mapping.GROUP_TYPE.group) {
                        //一般分帳群
                        lend[debt.borrower]['group_normal'].push(group);
                    } else {
                        //團購分帳群
                        lend[debt.borrower]['group_buying'].push(group);
                    }
                }
                data.lend = Object.values(lend);
            });
        }
        summary.net = summary.lend - summary.borrow;
        data.summary = summary;
        return res.status(200).json({ data });
    } catch (err) {
        console.error('@getUserBalances: err: ', err);
        return res.status(500).json({ err: 'Internal Server Error.' });
    }
};

module.exports = { getDebts, getDebtDetail, getDebtDetail, getDebtPages, getMeberBalances, getSettle, getSettlePair, getUserBalances };
