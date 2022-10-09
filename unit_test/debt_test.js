const { triangle_1, triangle_2 } = require('./fake_data');
const DebtTest = require('./modify_debt');
const { signIn } = require('./signin');

const correct = {
    email: 'test1@test.com',
    password: '12345678',
};
const { gid, body } = triangle_1;

const debtTest = async (input, gid, body) => {
    const res = await signIn(input);
    if (!res.ok) {
        const msg = await res.text();
        console.log('error: ', msg);
        return;
    }
    const data = await res.json();
    const token = data.data.accessToken;
    console.log('token: ', token);

    //test1 create Debt
    const createResult = await DebtTest.createDebtTest(gid, token, body);
    if (!createResult.ok) {
        const msg = await createResult.text();
        console.log('error: ', msg);
        return;
    }
    const createResultData = await createResult.json();
    const newDebtId = createResultData.data.debtId;
    console.log('newDebtId: ', newDebtId);

    //test2 upddate Debt
    const updateResult = await DebtTest.updateDebtTest(gid, token, body, newDebtId);
    if (!updateResult.ok) {
        const msg = await updateResult.text();
        console.log('error: ', msg);
        return;
    }
    const updateResultData = await updateResult.json();
    const updatedDebtId = updateResultData.data.debtId;
    console.log('updatedDebtId: ', updatedDebtId);

    //test3 delete Debt
    const deleteResult = await DebtTest.deleteDebtTest(gid, token, updatedDebtId);
    if (!deleteResult.ok) {
        const msg = await deleteResult.text();
        console.log('error: ', msg);
        return;
    }
    const deleteResultData = await deleteResult.json();
    const deleteDebtId = deleteResultData.data.debtId;
    console.log('deleteDebtId: ', deleteDebtId);
};

debtTest(correct, gid, body);
