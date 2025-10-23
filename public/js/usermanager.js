function hasUserId(userid, callback){
    // 익명 사용자의 ID 정보가 서버에 존재하는지 확인하는 요청
    const response = fetch('/suid', {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain',
        },
        body: userid
    });
	
	response.then((resp) => {
		if (resp.ok){
			const data = resp.json();
			data.then((d) => {
				if (Object.hasOwn(d, 'exists') && callback)
					callback(d.exists);
			});
		}
	});
}

function makeNewId(){
    // 익명 사용자를 구분하기 위한 고유 식별자 정보를 서버로부터 발급
    const response = fetch('/cuid', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    response.then((resp) => {
        if (resp.ok){
            const data = resp.json();
            data.then((d) => {
                localStorage.setItem('webeq_userid', d.userId);
            });
        }
    });
}

// 해당 파일 외부에서 상수/변수 접근 방지를 위한 스코프 지정
(() => {
    const userId = localStorage.getItem('webeq_userid');
    if (userId){
        // 브라우저 ID 정보가 서버에 존재하는지 확인
        hasUserId(userId, (result) => {
			// 존재하지 않으면 새로 발급
            if (!result){
				makeNewId();
			}
        });
    }else{
        // 처음부터 브라우저 ID 정보가 없다면, 새로 생성
        makeNewId();
    }
})();