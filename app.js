const express = require('express');
const path = require('path');

// Express 앱 생성
const app = express();
// 서버 포트
const port = 3000;

// public 폴더를 정적 파일 제공을 위한 폴더로 설정
app.use(express.static(path.join(__dirname, 'public')));

// 서버 리스닝 시작
app.listen(port, () => {
    console.log('[INFO]: Server started...!')
});