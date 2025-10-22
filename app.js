const { v4: uuidv4 } = require('uuid');
const mariadb = require('mariadb');
const express = require('express');
const path = require('path');

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

async function initTables(){
    try{
        const conn = await dbpool.getConnection();
        await conn.query("CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY, creation_time DATETIME)");
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
        await conn.query(`INSERT INTO users VALUES (?, NOW())`, [userid]);
    }catch(err){
        console.log(err)
    }
}

initTables();

// public 폴더를 정적 파일 제공을 위한 폴더로 설정
app.use(express.static(path.join(__dirname, 'public')));

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