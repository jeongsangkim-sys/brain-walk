// 스트룹 — 글자가 아니라 "색"을 고르기 (Stroop, 1935)
window.GAME_STROOP = {
  id: "stroop",
  name: "색깔 맞히기",
  intro: "단어의 뜻이 아니라\n글자의 '색깔'을 고르세요.",

  start(area, level, api) {
    const COLORS = [
      { name: "빨강", css: "#C94F4F" },
      { name: "파랑", css: "#3A6EA5" },
      { name: "초록", css: "#3E8E5A" },
      { name: "노랑", css: "#D9A422" }
    ];
    let correct = 0, wrong = 0;
    const TARGET = 12;
    // 레벨이 오를수록 뜻≠색 (간섭) 비율 증가
    const conflictP = Math.min(0.9, 0.4 + level * 0.1);

    area.innerHTML = `
      <div class="problem" id="st-word"></div>
      <div class="feedback" id="st-fb"></div>
      <div class="choices" id="st-choices"></div>`;
    const elW = area.querySelector("#st-word");
    const elFb = area.querySelector("#st-fb");
    const elC = area.querySelector("#st-choices");

    elC.innerHTML = "";
    COLORS.forEach(c => {
      const b = document.createElement("button");
      b.className = "choice-btn";
      b.textContent = c.name;
      b.style.borderColor = c.css;
      b.style.color = c.css;
      b.dataset.name = c.name;
      elC.appendChild(b);
    });

    let ink = null;
    function next() {
      const word = COLORS[Math.floor(Math.random() * COLORS.length)];
      if (Math.random() < conflictP) {
        do { ink = COLORS[Math.floor(Math.random() * COLORS.length)]; } while (ink.name === word.name);
      } else {
        ink = word;
      }
      elW.textContent = word.name;
      elW.style.color = ink.css;
    }

    elC.querySelectorAll("button").forEach(b => {
      b.onclick = () => {
        if (b.dataset.name === ink.name) { correct++; elFb.textContent = "정답!"; elFb.className = "feedback flash-good"; }
        else { wrong++; elFb.textContent = "색을 보세요!"; elFb.className = "feedback flash-bad"; }
        next();
      };
    });
    next();

    api.onTimeUp(() => {
      const attempts = correct + wrong;
      const acc = attempts ? correct / attempts : 0;
      const score = Math.round(100 * acc * Math.min(1, attempts / TARGET));
      api.finish(score, `정답 ${correct} · 오답 ${wrong}`);
    });
  }
};
