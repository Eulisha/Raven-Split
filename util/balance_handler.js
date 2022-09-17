const Debt = require('../models/debt_model');
const pool = require('../config/mysql');

const updateBalance = async (conn, debtMain, debtDetail) => {
    try {
        console.log('@updatebalance@ main, detail: ', debtMain, debtDetail);
        // 拉出pair本來的借貸並更新
        for (let debt of debtDetail) {
            //剔除自己的帳
            if (debt.borrower===debtMain.lender){
                continue
            }
            //查正向 borrower-own->lender
            const getBalanceResult = await Debt.getBalance(conn, debtMain.gid, debt.borrower, debtMain.lender);
            if (!getBalanceResult) {
                throw new Error('Internal Server Error');
            }
            if (getBalanceResult.length !== 0) {
                // console.log('balance1:');
                // 原本債務關係和目前一樣 borrower-own->lender
                let balanceId = getBalanceResult[0].id;
                let originalDebt = getBalanceResult[0].amount;
                let newBalance = originalDebt + debt.amount; //add more debt
                // console.log('balanceId:', balanceId, 'originalDebt: ', originalDebt, 'newBalance: ', newBalance);
                if (newBalance >= 0) {
                    // console.log('>0');
                    //  維持 borrower-own->lender
                    const result = await Debt.updateBalance(conn, balanceId, debt.borrower, debtMain.lender, newBalance);
                    if (!result) {
                        throw new Error('Internal Server Error');
                    }
                } else {
                    // console.log('<0');
                    // 改為 borrower <-own-lender
                    const result = await Debt.updateBalance(conn, balanceId, debtMain.lender, debt.borrower, -newBalance);
                    if (!result) {
                        throw new Error('Internal Server Error');
                    }
                }
            } else {
                // 查反向 borrower <-own-lender
                const getBalanceResult = await Debt.getBalance(conn, debtMain.gid, debtMain.lender, debt.borrower);
                if (!getBalanceResult) {
                    throw new Error('Internal Server Error');
                }
                if (getBalanceResult.length !== 0) {
                    // console.log('balance2:');
                    // 原本債務關係和目前相反 borrower <-own-lender
                    let balanceId = getBalanceResult[0].id;
                    let originalDebt = getBalanceResult[0].amount;
                    let newBalance = originalDebt - debt.amount; //pay back
                    // console.log('balanceId:', balanceId, 'originalDebt: ', originalDebt, 'newBalance: ', newBalance);
                    if (newBalance > 0) {
                        // console.log('>0');
                        //  維持 borrower <-own-lender
                        const result = await Debt.updateBalance(conn, balanceId, debtMain.lender, debt.borrower, newBalance);
                        if (!result) {
                            throw new Error('Internal Server Error');
                        }
                    } else {
                        // console.log('<0');
                        // 改為 borrower-own->lender
                        const result = await Debt.updateBalance(conn, balanceId, debt.borrower, debtMain.lender, -newBalance);
                        if (!result) {
                            throw new Error('Internal Server Error');
                        }
                    }
                    //都沒查到，新增一筆
                } else {
                    const result = await Debt.createBalance(conn, debtMain.gid, debt.borrower, debtMain.lender, debt.amount);
                    if (!result) {
                        throw new Error('Internal Server Error');
                    }
                }
            }
        }
        return true;
    } catch (err) {
        console.log(err);
    }
};
const createBatchBalance = async (req, res) => {
    //批次建立建立member balance, 暫時沒用到
    //整理members的排列組合
    let memberCombo = [];
    for (let i = 0; i < members.length; i++) {
        for (let j = 0; j < members.length - 1; j++) {
            let x = i + j + 1;
            if (x > members.length - 1) {
                break;
            }
            memberCombo.push([members[i], members[x]]);
        }
    }
    console.log(memberCombo);
    const balanceResult = await Admin.createBatchBalance(groupId, memberCombo, conn);
    if (!balanceResult) {
        return res.status(500).json({ err: 'Internal Server Error' });
    }
};
module.exports = { createBatchBalance, updateBalance };
