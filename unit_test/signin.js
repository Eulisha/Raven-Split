const signIn = async (input) => {
    const { email, password } = input;
    console.log('input: ', input);
    try {
        const res = await fetch('https://raven-split.life/api/user/signin', {
            headers: {
                accept: 'application/json, text/plain, */*',
                'content-type': 'application/json',
            },
            body: `{"email":"${email}","password":"${password}","provider":"native"}`,
            method: 'POST',
        });
        return res;
    } catch (err) {
        console.err(err);
        throw new Error(err);
    }
};

module.exports = { signIn };
