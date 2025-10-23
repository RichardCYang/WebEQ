const { v4: uuidv4 } = require('uuid');
const mariadb = require('mariadb');
const express = require('express');
const path = require('path');
const os = require('os');

// Express 앱 생성
const app = express();
// 서버 포트
const port = 3000;

// 데이터베이스 접속 정보 설정
const dbpool = mariadb.createPool({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'admin',
    database: 'webeq'
});

function getFormattedCurrentTime() {
	const now = new Date();

	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0'); // 월은 0부터 시작하므로 +1
	const day = String(now.getDate()).padStart(2, '0');

	let hours = now.getHours();
	const minutes = String(now.getMinutes()).padStart(2, '0');
	const seconds = String(now.getSeconds()).padStart(2, '0');

	// 오후/오전 결정 및 12시간 형식으로 변환
	const ampm = hours >= 12 ? '오후' : '오전';
	hours = hours % 12;
	
	// 0시(자정)를 12시로 표시
	if (hours === 0)
		hours = 12;
	
	return `${year}. ${month}. ${day} ${ampm} ${hours}:${minutes}:${seconds}`;
}

function makeEQSettingText(eqnodes){
	let data = 'Filter Settings file' + os.EOL;
	data = data + os.EOL;
	data = data + 'Web eq V0.01.1' + os.EOL;
	data = data + 'Dated: ' + getFormattedCurrentTime() + os.EOL;
	data = data + os.EOL;
	data = data + 'Notes' + os.EOL;
	data = data + os.EOL;
	data = data + 'Equaliser: Generic' + os.EOL;
	data = data + 'No measurement' + os.EOL;
    
    if (!eqnodes || eqnodes.length < 1)
        return data;

    eqnodes.forEach((node, idx) => {
        let type = 'None';

        switch (node.type){
            case 'LOW_PASS':
                type = 'LP';
                break;
            case 'HIGH_PASS':
                type = 'HP';
                break;
            case 'LOW_SHELF':
                type = 'LS';
                break;
            case 'HIGH_SHELF':
                type = 'HS';
                break;
            case 'PEAK':
                type = 'PK';
                break;
            case 'NOTCH':
                type = 'NOTCH';
                break;
        }

        data = data + `Filter  ${idx + 1}: ON  ${type}       Fc   ${node.freq} Gain   ${node.gain} dB  Q ${node.qValue}` + os.EOL;
    });

    return data;
}

async function initTables(){
    try{
        const conn = await dbpool.getConnection();
        await conn.query("CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY, creation_time DATETIME, eqsettingdata TEXT)");
    }catch(err){
        console.log(err);
    }
}

async function updateUserEQSettingData(userid, eqsettingdata){
    try{
        const conn = await dbpool.getConnection();
        await conn.query("UPDATE users SET eqsettingdata = ? WHERE id = ?", [eqsettingdata, userid]);
    }catch(err){
        console.log(err);
    }
}

async function hasUserFromDB(userid){
    try{
        const conn = await dbpool.getConnection();
        const rows = await conn.query("SELECT COUNT(*) AS count FROM users WHERE id = ?", [userid]);
        if (rows && rows.length > 0){
            const cnt = Number(rows[0].count);
            return cnt > 0;
        }
        return false;
    }catch(err){
        console.log(err);
    }
}

async function makeNewUserToDB(userid){
    try{
        const conn = await dbpool.getConnection();
        await conn.query(`INSERT INTO users (id, creation_time) VALUES (?, NOW())`, [userid]);
    }catch(err){
        console.log(err)
    }
}

initTables();

// public 폴더를 정적 파일 제공을 위한 폴더로 설정
app.use(express.static(path.join(__dirname, 'public')));

// EQ 설정 텍스트 정보 임시 저장 요청이 왔을 때 처리할 핸들러
app.post('/cest', express.json(), (req, res) => {
	const body = req.body;
    if (!body) {
        res.status(400).end();
        return;
    }

    if (!Object.hasOwn(body, 'eqFilters')) {
        res.status(400).end();
        return;
    }

    if (!Object.hasOwn(body, 'userid')) {
        res.status(400).end();
        return;
    }

    // 클라이언트로부터 받은 정보를 바탕으로 EQ 설정 텍스트 파일 포맷 생성
    const txtdata = makeEQSettingText(body.eqFilters);

    updateUserEQSettingData(body.userid, txtdata).then(() => {
        res.status(200).end();
        return;
    }).catch((err) => {
        res.status(400).end();
        return;
    });
});

// 사용자 식별자 정보 발급 POST 요청이 왔을 때 처리할 핸들러
app.post('/cuid', (req, res) => {
    // UUID v4 기반 사용자 고유 ID 생성
    const newUserId = uuidv4();

    // 해당 UUID v4 기반으로 사용자 정보 생성
    makeNewUserToDB(newUserId);

    // 생성된 ID를 JSON 형태로 클라이언트에 응답
    res.status(200).json({
        message: 'User ID successfully created.',
        userId: newUserId,
    });
});

// 사용자 식별자 정보 존재 유무 확인 요청이 왔을 때 처리할 핸들러
app.post('/suid', express.text(), (req, res) => {
    hasUserFromDB('aaa').then(result => {
        res.json({exists: result});
    });
});

// 서버 리스닝 시작
app.listen(port, () => {
    console.log('[INFO]: Server started...!')
});