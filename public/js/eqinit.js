// ==========================================================
// 1. 상수 및 전역 변수 정의
// ==========================================================
const SAMPLE_RATE = 48000;
const PI = Math.PI;
const CANVAS = document.getElementById("responseCanvas");
const CTX = CANVAS.getContext("2d");
const WRAPPER = document.getElementById("graph-wrapper");
const PEQ_LIST = document.getElementById("peq-list");
const CONTROLS_CONTAINER = document.getElementById("controls-container");
const GEQ_CONTAINER = document.getElementById("geq-container");
const ADD_PEQ_BUTTON = document.getElementById("add-eq-btn");
const MODAL = document.getElementById("peq-modal");
const MODAL_ID_DISPLAY = document.getElementById("modal-eq-id-display");
const MODAL_INPUTS = document.getElementById("modal-inputs");
const MODAL_ACTIONS = document.getElementById("modal-actions");

const GAIN_HEIGHT = 380;

const MIN_DB = -15;
const MAX_DB = 15;
const DB_RANGE = MAX_DB - MIN_DB;

const MIN_FREQ = 20;
const MAX_FREQ = 20000;

const NUM_POINTS = 400;
let FREQ_POINTS_LOG = [];
let eqFilters = [];
let currentModalEqId = null;
let isModalNewFilter = false;

const GEQ_FREQS_RAW = [
	20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500,
	630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000,
	10000, 12500, 16000, 20000,
];

const GEQ_FREQS = GEQ_FREQS_RAW.map((f) => parseFloat(f.toFixed(2)));
const GEQ_Q_VALUE = 4.31;

let geqFilters = [];
let isDragging = false;
let draggingEqId = null;

const WRAPPER_OFFSET_LEFT = 50;

let activeTab = "peq";

function initializeFreqPoints() {
	const logMin = Math.log10(MIN_FREQ);
	const logMax = Math.log10(MAX_FREQ);
	const logRange = logMax - logMin;
	FREQ_POINTS_LOG = [];

	for (let i = 0; i < NUM_POINTS; i++) {
		const logFreq = logMin + (i / (NUM_POINTS - 1)) * logRange;
		FREQ_POINTS_LOG.push(Math.pow(10, logFreq));
	}
}

initializeFreqPoints();

// ==========================================================
// 2. 필터 계수 계산 및 응답 계산 함수 (이전과 동일)
// ==========================================================
function calculateSingleBiquad(type, freq, gainDB, Q){
	if (freq <= 0 || Q <= 0) return { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 };

	const A = Math.pow(10, gainDB / 40);
	const omega = (2 * PI * freq) / SAMPLE_RATE;
	const alpha = Math.sin(omega) / (2 * Q);
	const cos_omega = Math.cos(omega);

	let b0 = 0, b1 = 0, b2 = 0, a0 = 0, a1 = 0, a2 = 0;

	switch (type){
		case "PEAK":
			b0 = 1 + alpha * A;
			b1 = -2 * cos_omega;
			b2 = 1 - alpha * A;
			a0 = 1 + alpha / A;
			a1 = -2 * cos_omega;
			a2 = 1 - alpha / A;
			break;
		case "LOW_SHELF":
			const sqrtA = Math.sqrt(A);
			b0 = A * (A + 1 - (A - 1) * cos_omega + 2 * sqrtA * alpha);
			b1 = 2 * A * (A - 1 - (A + 1) * cos_omega);
			b2 = A * (A + 1 - (A - 1) * cos_omega - 2 * sqrtA * alpha);
			a0 = A + 1 + (A - 1) * cos_omega + 2 * sqrtA * alpha;
			a1 = -2 * (A - 1 + (A + 1) * cos_omega);
			a2 = A + 1 + (A - 1) * cos_omega - 2 * sqrtA * alpha;
			break;
		case "HIGH_SHELF":
			const sqrtA_h = Math.sqrt(A);
			b0 = A * (A + 1 + (A - 1) * cos_omega + 2 * sqrtA_h * alpha);
			b1 = -2 * A * (A - 1 + (A + 1) * cos_omega);
			b2 = A * (A + 1 + (A - 1) * cos_omega - 2 * sqrtA_h * alpha);
			a0 = A + 1 - (A - 1) * cos_omega + 2 * sqrtA_h * alpha;
			a1 = 2 * (A - 1 - (A + 1) * cos_omega);
			a2 = A + 1 - (A - 1) * cos_omega - 2 * sqrtA_h * alpha;
			break;
		case "NOTCH":
			b0 = 1;
			b1 = -2 * cos_omega;
			b2 = 1;
			a0 = 1 + alpha;
			a1 = -2 * cos_omega;
			a2 = 1 - alpha;
			break;
		case "LOW_PASS":
			b0 = (1 - cos_omega) / 2;
			b1 = 1 - cos_omega;
			b2 = (1 - cos_omega) / 2;
			a0 = 1 + alpha;
			a1 = -2 * cos_omega;
			a2 = 1 - alpha;
			break;
		case "HIGH_PASS":
			b0 = (1 + cos_omega) / 2;
			b1 = -(1 + cos_omega);
			b2 = (1 + cos_omega) / 2;
			a0 = 1 + alpha;
			a1 = -2 * cos_omega;
			a2 = 1 - alpha;
			break;
		case "LOW_PASS_1ST":
			a0 = 1 + alpha;
			a1 = -(1 + alpha);
			a2 = 0;
			b0 = alpha;
			b1 = alpha;
			b2 = 0;
			b0 /= a0;
			b1 /= a0;
			a1 /= a0;
			return { b0: b0, b1: b1, b2: 0, a1: a1, a2: 0 };
		case "HIGH_PASS_1ST":
			a0 = 1 + alpha;
			a1 = -(1 + alpha);
			a2 = 0;
			b0 = 1;
			b1 = -1;
			b2 = 0;
			b0 /= a0;
			b1 /= a0;
			a1 /= a0;
			return { b0: b0, b1: b1, b2: 0, a1: a1, a2: 0 };
		default:
			return { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 };
	}

	b0 /= a0;
	b1 /= a0;
	b2 /= a0;
	a1 /= a0;
	a2 /= a0;
	
	return { b0, b1, b2, a1, a2 };
}

function calculateMagnitudeResponse(f, coefs){
	const { b0, b1, b2, a1, a2 } = coefs;
	const w = (2 * PI * f) / SAMPLE_RATE;

	const cos_w = Math.cos(w);
	const cos_2w = Math.cos(2 * w);

	const num_re = b0 + b1 * cos_w + b2 * cos_2w;
	const num_im = -b1 * Math.sin(w) - b2 * Math.sin(2 * w);
	const num_mag_sq = num_re * num_re + num_im * num_im;

	const den_re = 1 + a1 * cos_w + a2 * cos_2w;
	const den_im = -a1 * Math.sin(w) - a2 * Math.sin(2 * w);
	const den_mag_sq = den_re * den_re + den_im * den_im;

	const magnitude = Math.sqrt(num_mag_sq / den_mag_sq);
	return magnitude;
}

// ==========================================================
// 3. PEQ 컨트롤 동적 생성 및 관리 (이전과 동일)
// ==========================================================
function getFilterDefaults(type){
	switch (type){
		case "PEAK":
			return { freq: 1000, gain: 0, qValue: 1.0, short: "PK" };
		case "LOW_SHELF":
			return { freq: 100, gain: 0, qValue: 0.707, short: "LS" };
		case "HIGH_SHELF":
			return { freq: 8000, gain: 0, qValue: 0.707, short: "HS" };
		case "NOTCH":
			return { freq: 500, gain: 0, qValue: 10, short: "NT" };
		case "LOW_PASS":
			return {
				freq: 1000,
				gain: 0,
				qValue: 0.707,
				slope: 12,
				short: "LP",
			};
		case "HIGH_PASS":
		return {
				freq: 100,
				gain: 0,
				qValue: 0.707,
				slope: 12,
				short: "HP",
		};
		default:
			return { freq: 1000, gain: 0, qValue: 1.0, short: "PK" };
	}
}

function getRandomNonOverlappingFreq(){
	const existingFreqs = eqFilters.map((f) => f.freq);
	
	let newFreq;
	let safetyCounter = 0;
	
	do {
		const logMin = Math.log10(MIN_FREQ);
		const logMax = Math.log10(MAX_FREQ);
		const randomLogF = logMin + Math.random() * (logMax - logMin);
		newFreq = Math.round(Math.pow(10, randomLogF));

		const isOverlapping = existingFreqs.some((f) => Math.abs(f - newFreq) / newFreq < 0.1);
		if (!isOverlapping) break;

		safetyCounter++;
	} while (safetyCounter < 100);

	return Math.max(MIN_FREQ, Math.min(MAX_FREQ, newFreq));
}

function addPEQ(initialData, isNew = false){
	// ID 충돌 방지를 위해 최대 ID + 1 사용
	const id = eqFilters.length > 0 ? Math.max(...eqFilters.map((p) => p.id)) + 1 : 0;
	const type = initialData?.type || "PEAK";
	const defaults = getFilterDefaults(type);
	const newFreq = initialData?.freq || getRandomNonOverlappingFreq();

	const newPEQ = {
		id: id,
		type: type,
		freq: newFreq,
		gain: initialData?.gain !== undefined ? initialData.gain : defaults.gain,
		qValue: initialData?.qValue || defaults.qValue,
		slope: initialData?.slope || defaults.slope || 12,
		enabled: true,
	};

	if (isNew){
		newPEQ.isTemporary = true;
		eqFilters.push(newPEQ);
	} else {
		eqFilters.push(newPEQ);
	}

	if (!isNew){
		renderControls();
		updateGraph();
	}

	if (isNew)
		openModal(id, true);
	
	return newPEQ;
}

function removePEQ(idToRemove){
	eqFilters = eqFilters.filter((eq) => eq.id !== idToRemove);
	renderControls();
	updateGraph();
	closeModal();
}

function resetGain(id){
	const eq = eqFilters.find((p) => p.id === id);
	if (eq && (eq.type === "PEAK" || eq.type === "LOW_SHELF" || eq.type === "HIGH_SHELF")){
		eq.gain = 0.0;
		renderControls();
		updateGraph();
	}
}

function savePEQ(){
	if (confirm("모든 PEQ 필터를 저장하시겠습니까?")) {
		const userId = localStorage.getItem('webeq_userid');
		if (!userId) {
			alert("비정상적 사용자입니다! 웹페이지를 새로고침 해보세요.");
			return;
		}

		const data = {}
		data.eqFilters = eqFilters;
		data.userid = userId;

		const response = fetch('/cest', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(data)
		});
		
		response.then((resp) => {
			if (resp.ok)
				alert("저장되었습니다!");
		});
	}
}

function resetPEQ(){
	if (confirm("모든 PEQ 필터를 삭제하고 초기화하시겠습니까?")) {
		eqFilters = [];
		renderControls();
		updateGraph();
		closeModal();
	}
}

function resetGEQ(){
	if (confirm("모든 GEQ 게인을 0dB로 초기화하시겠습니까?")) {
		geqFilters.forEach((f) => (f.gain = 0));
		renderGEQControls();
		updateGraph();
	}
}

// PEQ 간략 카드 렌더링
function renderControls(){
	// 기존 카드 요소들만 제거 (추가 버튼과 리셋 버튼은 유지)
	CONTROLS_CONTAINER.querySelectorAll(".peq-card").forEach((card) => card.remove());

	eqFilters.forEach((eq) => {
		if (eq.isTemporary) return;

		const defaults = getFilterDefaults(eq.type);
		const typeShort = defaults.short;

		let gainOrOrderText = "";
		let qText = "";

		if (eq.type === "NOTCH"){
			gainOrOrderText = "N/A";
			qText = `Q: ${eq.qValue.toFixed(3)}`;
		}else if(eq.type === "LOW_PASS" || eq.type === "HIGH_PASS"){
			qText = `Q: ${eq.qValue.toFixed(3)}`;
			gainOrOrderText = `${eq.slope}dB/oct`;
		}else{
			gainOrOrderText = `${eq.gain >= 0 ? "+" : ""}${eq.gain.toFixed(1)}dB`;
			qText = `Q: ${eq.qValue.toFixed(3)}`;
		}

		const cardDiv = document.createElement("div");
			cardDiv.className = "peq-card";
			cardDiv.dataset.id = eq.id;

			cardDiv.onclick = () => openModal(eq.id, false);
			cardDiv.ondblclick = (e) => {
			e.stopPropagation();
			resetGain(eq.id);
		};

		cardDiv.innerHTML = `
				<strong>#${eq.id + 1}</strong> 
				<span class="sep">/</span> 
				<strong>${typeShort}</strong>
				<span class="sep">/</span>
				<span id="freq-display-${eq.id}">${eq.freq.toFixed(0)}</span>Hz
				<span class="sep">/</span>
				<span id="gain-display-${eq.id}">${gainOrOrderText}</span>
				<span class="sep">/</span>
				<span id="q-display-${eq.id}">${qText}</span>
			`;
		PEQ_LIST.appendChild(cardDiv);
	});
}

// ==========================================================
// 4. PEQ 상세 조작 모달 (이전과 동일)
// ==========================================================
function openModal(id, isNew){
	const eq = eqFilters.find((p) => p.id === id);
	if (!eq) return;

	currentModalEqId = id;
	isModalNewFilter = isNew;

	MODAL_ID_DISPLAY.textContent = isNew ? "임시" : id + 1;
	MODAL_INPUTS.innerHTML = "";

	// 필터 유형 선택
	const typeGroup = document.createElement("div");
	typeGroup.className = "input-group";
	typeGroup.innerHTML = `<label for="modal-type">유형</label><select id="modal-type" data-param="type">
		<option value="PEAK" ${
		  eq.type === "PEAK" ? "selected" : ""
		}>PEAK (PEQ)</option>
		<option value="LOW_SHELF" ${
		  eq.type === "LOW_SHELF" ? "selected" : ""
		}>Low Shelf</option>
		<option value="HIGH_SHELF" ${
		  eq.type === "HIGH_SHELF" ? "selected" : ""
		}>High Shelf</option>
		<option value="NOTCH" ${
		  eq.type === "NOTCH" ? "selected" : ""
		}>Notch Filter</option>
		<option value="LOW_PASS" ${
		  eq.type === "LOW_PASS" ? "selected" : ""
		}>Low Pass</option>
		<option value="HIGH_PASS" ${
		  eq.type === "HIGH_PASS" ? "selected" : ""
		}>High Pass</option>
	</select>`;
	typeGroup.querySelector("select").addEventListener("change", handleModalChange);
	MODAL_INPUTS.appendChild(typeGroup);

	// 주파수 입력
	const freqGroup = document.createElement("div");
	freqGroup.className = "input-group";
	freqGroup.innerHTML = `<label for="modal-freq">주파수 (Hz)</label><input type="number" id="modal-freq" data-param="freq" min="${MIN_FREQ}" max="${MAX_FREQ}" step="1" value="${eq.freq.toFixed(0)}">`;
	freqGroup.querySelector("input").addEventListener("input", handleModalChange);
	MODAL_INPUTS.appendChild(freqGroup);

	// 게인 입력 (PEAK, SHELF에서만)
	if (eq.type.includes("PEAK") || eq.type.includes("SHELF")){
		const gainGroup = document.createElement("div");
		gainGroup.className = "input-group";
		gainGroup.innerHTML = `<label for="modal-gain">게인 (dB)</label><input type="number" id="modal-gain" data-param="gain" min="${MIN_DB}" max="${MAX_DB}" step="0.1" value="${eq.gain.toFixed(1)}">`;
		gainGroup.querySelector("input").addEventListener("input", handleModalChange);
		MODAL_INPUTS.appendChild(gainGroup);
	}

	// Q/밴드폭 입력
	if (eq.type !== "LOW_PASS" && eq.type !== "HIGH_PASS"){
		const qGroup = document.createElement("div");
		qGroup.className = "input-group";

		let minQ = 0.1, maxQ = 10, stepQ = 0.1;

		if (eq.type === "NOTCH"){
			maxQ = 100;
			stepQ = 0.5;
		}

		qGroup.innerHTML = `<label for="modal-q">Q 값</label><input type="number" id="modal-q" data-param="qValue" min="${minQ}" max="${maxQ}" step="${stepQ}" value="${eq.qValue.toFixed(3)}">`;
		qGroup.querySelector("input").addEventListener("input", handleModalChange);
		MODAL_INPUTS.appendChild(qGroup);
	}

	// 슬로프 입력 (LP/HP에서만)
	if (eq.type === "LOW_PASS" || eq.type === "HIGH_PASS"){
		const slopeGroup = document.createElement("div");
		slopeGroup.className = "input-group";
		slopeGroup.innerHTML = `<label for="modal-slope">슬로프 (dB/oct)</label><select id="modal-slope" data-param="slope">
				<option value="6" ${
				  eq.slope === 6 ? "selected" : ""
				}>6 dB/oct (1차)</option>
				<option value="12" ${
				  eq.slope === 12 ? "selected" : ""
				}>12 dB/oct (2차)</option>
				<option value="18" ${
				  eq.slope === 18 ? "selected" : ""
				}>18 dB/oct (3차)</option>
				<option value="24" ${
				  eq.slope === 24 ? "selected" : ""
				}>24 dB/oct (4차)</option>
			</select>`;
		slopeGroup.querySelector("select").addEventListener("change", handleModalChange);
		MODAL_INPUTS.appendChild(slopeGroup);
	}

	// 버튼 동적 생성
	MODAL_ACTIONS.innerHTML = "";
	if (isNew) {
		// 추가 모드: 취소, 추가
		MODAL_ACTIONS.innerHTML = `
				<button id="modal-cancel-btn" onclick="cancelNewPEQ()">취소</button>
				<button id="modal-add-btn" onclick="saveNewPEQ()">추가</button>`;
	} else {
		// 수정 모드: 삭제
		MODAL_ACTIONS.innerHTML = `
				<button id="modal-delete-btn" onclick="confirmDeletePEQ(${id})">삭제</button>`;
	}

	MODAL.style.display = "flex";
}

function closeModal(){
	currentModalEqId = null;
	isModalNewFilter = false;
	MODAL.style.display = "none";
}

function saveNewPEQ(){
	const eq = eqFilters.find((p) => p.id === currentModalEqId);
	if (eq){
		delete eq.isTemporary;
		renderControls();
		updateGraph();
	}
	closeModal();
}

function cancelNewPEQ(){
	// 임시 필터를 eqFilters 배열에서 제거
	eqFilters = eqFilters.filter((p) => p.id !== currentModalEqId);
	renderControls();
	updateGraph();
	closeModal();
}

function confirmDeletePEQ(id){
	if (confirm(`PEQ 필터 #${id + 1}을(를) 정말로 삭제하시겠습니까?`))
	  removePEQ(id);
}

// 모달 외부 클릭 시 닫기
MODAL.addEventListener("click", (e) => {
	if (e.target === MODAL){
		if (isModalNewFilter)
			cancelNewPEQ();
		else
			closeModal();
	}
});

function handleModalChange(event){
	const eq = eqFilters.find((p) => p.id === currentModalEqId);
	if (!eq) return;

	const param = event.target.dataset.param;
	let value = event.target.value;

	if (param === "type"){
		const newType = value;
		const defaults = getFilterDefaults(newType);
		const oldQ = eq.qValue;
		eq.type = newType;
		eq.freq = defaults.freq;
		eq.gain = defaults.gain;
		eq.qValue = defaults.qValue;
		eq.slope = defaults.slope || 12;

		if (newType.includes("PEAK") || newType.includes("SHELF") || newType === "NOTCH")
			eq.qValue = oldQ;

		openModal(currentModalEqId, isModalNewFilter);
	}else{
		if (event.target.type === "number"){
			value = parseFloat(value);
			if (isNaN(value)) return;

			switch (param){
				case "gain":
					eq[param] = parseFloat(value.toFixed(1));
					break;
				case "qValue":
					eq[param] = parseFloat(value.toFixed(3));
					break;
				case "freq":
					eq[param] = Math.max(MIN_FREQ, Math.min(MAX_FREQ, Math.round(value)));
					break;
			}
		}else if(event.target.tagName === "SELECT"){
			if (param === "slope")
			  eq[param] = parseInt(value);
		}
	}

	renderControls();
	updateGraph();
}

// ==========================================================
// 5. GEQ 컨트롤 초기화 및 관리 (수정된 renderGEQControls 함수)
// ==========================================================
function initGEQ(){
	geqFilters = GEQ_FREQS.map((f) => ({
		freq: f,
		gain: 0,
		Q: GEQ_Q_VALUE,
	}));
	renderGEQControls();
}

function renderGEQControls(){
	GEQ_CONTAINER.innerHTML = "";

	// GEQ 슬라이더 그룹을 담을 div 생성
	const geqSlidersDiv = document.createElement("div");
	geqSlidersDiv.id = "geq-slider-group"; // CSS에서 정의된 ID 사용

	geqFilters.forEach((eq, index) => {
		const bandDiv = document.createElement("div");
		bandDiv.className = "geq-band";

		const display = document.createElement("div");
		display.className = "gain-display";
		display.textContent = `${eq.gain.toFixed(1)} dB`;

		const slider = document.createElement("input");
		slider.type = "range";
		slider.min = MIN_DB;
		slider.max = MAX_DB;
		slider.step = 0.1;
		slider.value = eq.gain;
		slider.dataset.index = index;

		slider.addEventListener("input", (e) => {
			const idx = parseInt(e.target.dataset.index);
			const newGain = parseFloat(e.target.value);
			geqFilters[idx].gain = newGain;
			display.textContent = `${newGain.toFixed(1)} dB`;
			updateGraph();
		});

		slider.addEventListener("dblclick", (e) => {
			e.preventDefault();
			
			const idx = parseInt(e.target.dataset.index);
			geqFilters[idx].gain = 0;
			e.target.value = 0;
			display.textContent = `0.0 dB`;
			updateGraph();
		});

		// 주파수 라벨 형식 조정
		const roundedFreq = Math.round(eq.freq);
		let labelText;
		
		if (roundedFreq >= 1000){
			const kValue = roundedFreq / 1000;
			labelText = kValue % 1 === 0 ? kValue.toFixed(0) + "k" : kValue.toFixed(2) + "k";
			labelText = labelText.replace(/\.00k$/, "k").replace(/(\.\d)0k$/, "$1k");
		}else{
			labelText = roundedFreq.toFixed(0);
		}

		const label = document.createElement("label");
		label.textContent = labelText;

		bandDiv.appendChild(display);
		bandDiv.appendChild(slider);
		bandDiv.appendChild(label);
		geqSlidersDiv.appendChild(bandDiv);
	});

	GEQ_CONTAINER.appendChild(geqSlidersDiv); // 슬라이더 그룹 추가

	// GEQ 초기화 버튼을 다시 추가 (CSS에 정의된 reset-btn 위치를 활용)
	const resetButton = document.createElement("button");
	resetButton.id = "reset-geq-btn";
	resetButton.className = "reset-btn";
	resetButton.textContent = "GEQ 전체 초기화";
	resetButton.onclick = resetGEQ;
	GEQ_CONTAINER.appendChild(resetButton);
}

// ==========================================================
// 6. 탭 전환 및 응답 분리 로직 (이전과 동일)
// ==========================================================
document.querySelectorAll(".tab-button").forEach((button) => {
	button.addEventListener("click", (e) => {
		closeModal();
		const tab = e.target.dataset.tab;

		document.querySelectorAll(".tab-button").forEach((btn) => btn.classList.remove("active"));
		e.target.classList.add("active");

		CONTROLS_CONTAINER.classList.remove("active");
		GEQ_CONTAINER.classList.remove("active");

		// GEQ 리셋 버튼 처리
		const resetGEQBtn = document.getElementById("reset-geq-btn");
		const resetPEQBtn = document.getElementById("reset-peq-btn");
		if (resetGEQBtn) resetGEQBtn.style.display = "none";
		if (resetPEQBtn) resetPEQBtn.style.display = "none";
		
		switch (tab){
			case "peq":
				CONTROLS_CONTAINER.classList.add("active");
				ADD_PEQ_BUTTON.style.display = "block";
				if (resetPEQBtn) resetPEQBtn.style.display = "block";
				break;
			case "geq":
				GEQ_CONTAINER.classList.add("active");
				ADD_PEQ_BUTTON.style.display = "none";
				if (resetGEQBtn) resetGEQBtn.style.display = "block";
				break;
		}

		activeTab = tab;
		updateGraph();
	});
});

function getPEQResponse(f, peqData){
	let totalMagnitude = 1.0;
	peqData.forEach((eq) => {
		if (eq.isTemporary) return;

		const type = eq.type;
		const freq = eq.freq;
		const gainDB = eq.gain;
		const slope = eq.slope;
		const Q = type === "LOW_PASS" || type === "HIGH_PASS" ? 0.707 : eq.qValue;

		if (type === "LOW_PASS" || type === "HIGH_PASS"){
			const order = slope / 6;
			let numBiquads = Math.floor(order / 2);
			let hasFirstOrder = order % 2 !== 0;

			for (let i = 0; i < numBiquads; i++){
				const coefs = calculateSingleBiquad(type, freq, 0, Q);
				totalMagnitude *= calculateMagnitudeResponse(f, coefs);
			}
			
			if (hasFirstOrder){
				const firstOrderType = type + "_1ST";
				const coefs = calculateSingleBiquad(firstOrderType, freq, 0, Q);
				totalMagnitude *= calculateMagnitudeResponse(f, coefs);
			}
		}else{
			const coefs = calculateSingleBiquad(type, freq, gainDB, Q);
			totalMagnitude *= calculateMagnitudeResponse(f, coefs);
		}
	});
	return { gainDB: 20 * Math.log10(totalMagnitude) };
}

function getGEQResponse(f, geqData){
	let totalMagnitude = 1.0;
	geqData.forEach((eq) => {
		if (eq.gain !== 0){
			const coefs = calculateSingleBiquad("PEAK", eq.freq, eq.gain, eq.Q);
			totalMagnitude *= calculateMagnitudeResponse(f, coefs);
		}
	});
	return { gainDB: 20 * Math.log10(totalMagnitude) };
}

function updateGraph(){
	let currentFreqPoints = [...FREQ_POINTS_LOG];
	let markerPositions = [];

	const allEqData = { peq: eqFilters, geq: geqFilters };

	allEqData.peq.forEach((eq) => {
		if (!eq.isTemporary && eq.freq >= MIN_FREQ && eq.freq <= MAX_FREQ && !currentFreqPoints.includes(eq.freq))
			currentFreqPoints.push(eq.freq);
	});
	
	allEqData.geq.forEach((eq) => {
		if (eq.freq >= MIN_FREQ && eq.freq <= MAX_FREQ && !currentFreqPoints.includes(eq.freq))
			currentFreqPoints.push(eq.freq);
	});
	
	currentFreqPoints.sort((a, b) => a - b);

	const logMin = Math.log10(MIN_FREQ);
	const logMax = Math.log10(MAX_FREQ);
	const logRange = logMax - logMin;

	let responseCurve = [];

	responseCurve = currentFreqPoints.map((f) => {
		let currentGainDB;
		let peqResponse = getPEQResponse(f, allEqData.peq.filter((p) => !p.isTemporary));
		let geqResponse = getGEQResponse(f, allEqData.geq);

		if (activeTab === "peq"){
			// PEQ 탭에서는 PEQ 응답만 표시
			currentGainDB = peqResponse.gainDB;

			// PEQ 마커 위치 계산
			allEqData.peq.filter((p) => !p.isTemporary).forEach((eq) => {
				if (Math.abs(f - eq.freq) < 1) {
					// 현재 주파수에서의 정확한 최종 게인값을 기반으로 마커 Y 위치 계산
					const y_at_freq = (GAIN_HEIGHT * (MAX_DB - currentGainDB)) / DB_RANGE;
					const x_at_freq = ((CANVAS.clientWidth + 1) * (Math.log10(eq.freq) - logMin)) / logRange;

					if (!markerPositions.some((m) => m.id === eq.id)){
						markerPositions.push({
							id: eq.id,
							x: x_at_freq,
							y: y_at_freq,
							type: eq.type,
							gainDB: currentGainDB,
						});
					}
				}
			});
		}else if(activeTab === "geq"){
			// GEQ 탭에서는 GEQ 응답만 표시
			currentGainDB = geqResponse.gainDB;
		}

		return { freq: f, gainDB: currentGainDB };
	});

	drawGraph(responseCurve, markerPositions);
}

// ==========================================================
// 7. 그래프 그리기 및 조작 함수 (수정된 drawGraph 함수)
// ==========================================================
function drawGraph(responseCurve, markerPositions){
	CTX.clearRect(0, 0, CANVAS.clientWidth + 1, GAIN_HEIGHT);
	CTX.fillStyle = "#1a1a1a";
	CTX.fillRect(0, 0, CANVAS.clientWidth + 1, GAIN_HEIGHT);
	CTX.font = "10px Arial";

	// 기존 라벨 및 마커 제거
	WRAPPER.querySelectorAll(".label-y-db, .label-x-freq, .eq-marker").forEach((e) => e.remove());

	const logMin = Math.log10(MIN_FREQ);
	const logMax = Math.log10(MAX_FREQ);
	const logRange = logMax - logMin;

	// 격자선 및 Y축 라벨
	const dbLines = [-15, -12, -9, -6, -3, 0, 3, 6, 9, 12, 15];
	
	for (let db of dbLines){
		const y = (GAIN_HEIGHT * (MAX_DB - db)) / DB_RANGE;
		CTX.beginPath();
		CTX.moveTo(0, y);
		CTX.lineTo(CANVAS.clientWidth + 1, y);
		CTX.strokeStyle = db === 0 ? "#888" : db % 6 === 0 ? "#555" : "#333";
		CTX.lineWidth = db === 0 ? 1.5 : db % 6 === 0 ? 1 : 0.5;
		CTX.stroke();

		// Y축 라벨 생성
		if (db % 3 === 0){
			const labelDiv = document.createElement("div");
			labelDiv.className = "label-y-db";
			labelDiv.textContent = (db > 0 ? "+" : "") + db + "dB";
			labelDiv.style.top = y - 7 + "px";
			// labelDiv.style.left는 CSS가 처리 (2px)
			WRAPPER.appendChild(labelDiv);
		}
	}

	// 격자선 및 X축 라벨
	const majorFreqs = [
		20, 50, 80, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 2000,
		3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 15000, 20000,
	];
	
	const xLabelTop = GAIN_HEIGHT + 10;
	
	for (let f of majorFreqs){
		if (f >= MIN_FREQ && f <= MAX_FREQ){
			const x = ((CANVAS.clientWidth + 1) * (Math.log10(f) - logMin)) / logRange;
			CTX.beginPath();
			CTX.moveTo(x, 0);
			CTX.lineTo(x, GAIN_HEIGHT);
			CTX.strokeStyle = f === 100 || f === 1000 || f === 10000 ? "#555" : "#333";
			CTX.stroke();

			// X축 라벨 생성 (CANVAS의 위치를 고려하여 50px offset)
			const label = f >= 1000 ? f / 1000 + "k" : f;
			const labelDiv = document.createElement("div");
			labelDiv.className = "label-x-freq";
			labelDiv.textContent = label;
			labelDiv.style.left = x + WRAPPER_OFFSET_LEFT + "px";
			labelDiv.style.top = xLabelTop + "px";
			WRAPPER.appendChild(labelDiv);
		}
	}

	// --- 3. 종합 응답 곡선 ---
	CTX.beginPath();
	CTX.strokeStyle = "#00ff7f";
	CTX.lineWidth = 3;
	responseCurve.forEach(({ freq, gainDB }, index) => {
		const logF = Math.log10(freq);
		const x = ((CANVAS.clientWidth + 1) * (logF - logMin)) / logRange;
		const y = (GAIN_HEIGHT * (MAX_DB - gainDB)) / DB_RANGE;
		if (index === 0)
			CTX.moveTo(x, y);
		else
			CTX.lineTo(x, y);
	});
	CTX.stroke();

	// --- 4. EQ 번호 마커 (PEQ 탭에서만 표시) ---
	if (activeTab === "peq") {
		markerPositions.forEach((marker) => {
			const markerDiv = document.createElement("div");
			markerDiv.className = "eq-marker";
			markerDiv.textContent = marker.id + 1;
			markerDiv.dataset.eqId = marker.id;
			// 마커 위치는 캔버스 좌표(x, y)를 래퍼 좌표계로 변환해야 함 (캔버스는 래퍼의 50px 위치에 있음)
			markerDiv.style.left = marker.x + WRAPPER_OFFSET_LEFT + "px";
			markerDiv.style.top = marker.y + "px";

			markerDiv.addEventListener("dblclick", (e) => {
				e.stopPropagation();
				resetGain(marker.id);
			});

			WRAPPER.appendChild(markerDiv);
		});
	}
}

function screenToFreq(x){
	const logMin = Math.log10(MIN_FREQ);
	const logMax = Math.log10(MAX_FREQ);
	const logRange = logMax - logMin;
	const logF = logMin + (x / (CANVAS.clientWidth + 1)) * logRange;
	return Math.pow(10, logF);
}

function screenToGainDB(y) {
	const ratio = y / GAIN_HEIGHT;
	return MAX_DB - ratio * DB_RANGE;
}

// --- 드래그 로직 (이전과 동일) ---
WRAPPER.addEventListener("mousemove", (e) => {
	if (draggingEqId !== null) return;

	const markerDiv = e.target.closest(".eq-marker");
	if (!markerDiv)
	  WRAPPER.style.cursor = "default";
});

WRAPPER.addEventListener("mouseleave", () => {
	WRAPPER.style.cursor = "default";
});

WRAPPER.addEventListener("mousedown", (e) => {
	if (activeTab !== "peq") return;

	const markerDiv = e.target.closest(".eq-marker");
	if (markerDiv){
		isDragging = false;
		draggingEqId = parseInt(markerDiv.dataset.eqId);
		
		if (MODAL.style.display === "flex"){
			draggingEqId = null;
			return;
		}
		
		document.addEventListener("mousemove", handleDragMove);
		document.addEventListener("mouseup", handleDragEnd);
		e.preventDefault();
	}
});

function handleDragMove(e){
	if (draggingEqId === null || activeTab !== "peq") return;
	isDragging = true;

	const eq = eqFilters.find((p) => p.id === draggingEqId);
	if (!eq) return;

	const rect = CANVAS.getBoundingClientRect();
	let x = e.clientX - rect.left;
	let y = e.clientY - rect.top;

	x = Math.max(0, Math.min((CANVAS.clientWidth + 1), x));
	y = Math.max(0, Math.min(GAIN_HEIGHT, y));

	let newFreq = screenToFreq(x);
	newFreq = Math.max(MIN_FREQ, Math.min(MAX_FREQ, newFreq));

	if (e.ctrlKey){
		const logF = Math.log10(newFreq);
		const logStep = (Math.log10(MAX_FREQ) - Math.log10(MIN_FREQ)) / 200;
		const logMin = Math.log10(MIN_FREQ);
		let snappedLogF = logMin + Math.round((logF - logMin) / logStep) * logStep;
		newFreq = Math.pow(10, snappedLogF);
	}

	eq.freq = parseFloat(newFreq.toFixed(0));

	if (eq.type === "PEAK" || eq.type === "LOW_SHELF" || eq.type === "HIGH_SHELF"){
		let newGain = screenToGainDB(y);
		newGain = Math.max(MIN_DB, Math.min(MAX_DB, newGain));

		if (e.ctrlKey){
			const step = 0.5;
			const diff = newGain - eq.gain;

			// 스냅 로직 개선
			const snappedGain = Math.round(newGain / step) * step;
			newGain = snappedGain;
		}

		newGain = Math.max(MIN_DB, Math.min(MAX_DB, newGain));
		eq.gain = parseFloat(newGain.toFixed(1));
	}

	renderControls();
	updateGraph();
}

function handleDragEnd(e){
	draggingEqId = null;
	isDragging = false;
	document.removeEventListener("mousemove", handleDragMove);
	document.removeEventListener("mouseup", handleDragEnd);
}

// --- 마우스 휠 (Q값 조절 - 이전과 동일) ---
WRAPPER.addEventListener("wheel", (e) => {
	const markerDiv = e.target.closest(".eq-marker");
	if (!markerDiv || activeTab !== "peq") return;

	e.preventDefault();

	const eqId = parseInt(markerDiv.dataset.eqId);
	const eq = eqFilters.find((p) => p.id === eqId);

	if (eq && eq.type !== "LOW_PASS" && eq.type !== "HIGH_PASS"){
		let qStep = e.ctrlKey ? 0.05 : eq.type === "NOTCH" ? 1.0 : 0.1;
		let qChange = e.deltaY < 0 ? qStep : -qStep;

		let newQ = eq.qValue + qChange;

		const minQ = 0.1;
		const maxQ = eq.type === "NOTCH" ? 100 : 10;
		newQ = Math.max(minQ, Math.min(maxQ, newQ));

		eq.qValue = parseFloat(newQ.toFixed(3));

		renderControls();
		updateGraph();
	}
});

// ==========================================================
// 8. 초기화 및 이벤트 리스너 등록
// ==========================================================
window.removePEQ = removePEQ;
window.resetGain = resetGain;
window.openModal = openModal;
window.closeModal = closeModal;
window.saveNewPEQ = saveNewPEQ;
window.cancelNewPEQ = cancelNewPEQ;
window.confirmDeletePEQ = confirmDeletePEQ;
window.resetPEQ = resetPEQ;
window.resetGEQ = resetGEQ;

document.getElementById("add-eq-btn").addEventListener("click", () => {
	addPEQ({ type: "PEAK", freq: 1000, gain: 0, qValue: 1.0 }, true);
});

window.onload = () => {
	initGEQ();

	addPEQ({ type: "LOW_PASS", freq: 15000, slope: 24, gain: 0 }, false);
	addPEQ({ type: "PEAK", freq: 1500, gain: 3, qValue: 2.0 }, false);
	addPEQ({ type: "HIGH_PASS", freq: 50, slope: 12, gain: 0 }, false);

	closeModal();
	
	CANVAS.width = CANVAS.clientWidth + 1;
	renderControls();
	updateGraph();
};

window.onresize = () => {
	CANVAS.width = CANVAS.clientWidth + 1;
	renderControls();
	updateGraph();
}

document.addEventListener("click", (e) => {
	const popup = document.getElementById("param-popup");
	if (popup.style.display === "block" && !popup.contains(e.target) && !e.target.closest(".peq-dot")){
		popup.style.display = "none";
		document.querySelectorAll(".peq-dot").forEach((d) => d.classList.remove("selected"));
		selectedFilterId = null;
	}
});

document.addEventListener("DOMContentLoaded", () => {
	const geqOption = document.getElementById("geq");
	const peqOption = document.getElementById("peq");
	const geqControls = document.getElementById("geq-controls");
	const peqControls = document.getElementById("peq-controls");
	const addFilterBtn = document.getElementById("add-filter-btn");

	function updateModeDisplay(type){
		geqOption.classList.toggle("active", type === "geq");
		peqOption.classList.toggle("active", type === "peq");

		geqControls.classList.toggle("visible", type === "geq");
		peqControls.classList.toggle("visible", type === "peq");

		document.getElementById("param-popup").style.display = "none";
		renderAllPeq();
	}

	createGeqSliders();
	addPeqFilterData();
	addPeqFilterData();
	renderAllPeq();

	updateModeDisplay("geq");

	addFilterBtn.addEventListener("click", () => {
		const newFilter = addPeqFilterData();
		renderAllPeq();
		// 새 필터 추가 후 그래프에 점이 렌더링된 후 selectFilter 호출
		setTimeout(() => selectFilter(newFilter.id), 0);
	});

	geqOption.addEventListener("click", () => updateModeDisplay("geq"));
	peqOption.addEventListener("click", () => updateModeDisplay("peq"));
});