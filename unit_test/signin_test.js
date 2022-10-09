const { signIn } = require('./signin');

const emptyColumn = {
    email: '',
    password: '',
    provider: '',
};

const incorrectEmailFormat1 = {
    email: 'test1',
    password: '12345678',
};

const incorrectEmailFormat2 = {
    email: -100,
    password: '12345678',
};
const incorrectEmailFormat3 = {
    email: ['a', 'b', 'c'],
    password: '12345678',
};

const notExistMember = {
    email: 'xxx@test.com',
    password: '12345678',
};

const incorrectPwFormat1 = {
    email: 'test1@test.com',
    password: ['a', 'b', 'c'],
};

const incorrectPwFormat2 = {
    email: 'test1@test.com',
    password: -100,
};

const correct = {
    email: 'test1@test.com',
    password: '12345678',
};

const testArray = [emptyColumn, incorrectEmailFormat1, incorrectEmailFormat2, incorrectEmailFormat3, notExistMember, incorrectPwFormat1, incorrectPwFormat2, correct];

const signinTest = async (testArray) => {
    for (let test of testArray) {
        const res = await signIn(test);

        //驗證
        if (res.ok) {
            const data = await res.json();
            const { accessToken, accessExpired, user, userGroups } = data;
            console.log(res.status);
            console.log(data);
            if (res.status !== 200) {
                console.log({ err: `Wrong status code: ${res.status}` });
            }
            if (!accessToken) {
                console.log({ err: 'NO ACCESSTOKEN' });
            } else if (!user) {
                console.log({ err: 'NO USER' });
            } else if (!userGroups) {
                console.log({ err: 'NO USERGROUPS' });
            } else {
                if (typeof accessToken !== 'string') {
                    console.log({ err: 'ACCESSTOKEN IS NOT A STRING' });
                } else if (!user.id) {
                    console.log({ err: 'NO USER ID' });
                }
            }
        } else {
            const msg = await res.text();
            // console.log(res.status, msg);
            if (res.status != 400 && res.status != 401 && res.status != 403 && res.status != 500) {
                console.log({ err: `Wrong status code: ${res.status}` });
            }
            if (!msg) {
                console.log({ err: 'NO ERROR MESSAGE INCLUDED' });
            }
        }
    }
};

const result = signinTest(testArray);
