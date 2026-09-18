/**
 * src/i18n/ko.ts
 *
 * 화면에 표시되는 모든 문자열 (1차 언어: 한국어).
 * src/data/*.json의 nameKey·descriptionKey·textKey·choiceKey는 이 객체의
 * 점(.) 경로와 대응한다 (예: "districts.slums.name" → ko.districts.slums.name).
 */
export const ko = {
  common: {
    gameTitle: 'GRAFT',
  },
  boot: {
    paletteLabel: '팔레트 견본',
    fontSampleKo: '비 내리는 네온 도시, 그림자 속 갱단이 움직인다',
    fontSampleEn: 'GRAFT — NEON CITY UNDERWORLD',
    fontSampleNum: '0123456789',
  },

  districts: {
    slums: { name: '슬럼' },
    harbor: { name: '항만' },
    underground_market: { name: '지하 시장' },
    nightclub_row: { name: '유흥가' },
    factory_district: { name: '공장 지대' },
    corporate_zone: { name: '기업 지구' },
  },

  businesses: {
    protection: {
      name: '보호비 징수',
      description: '평판이 높을수록 수입이 늘어난다. 열기는 낮은 편.',
    },
    clinic: {
      name: '사이버웨어 시술소',
      description: '기술이 필요하다. 자체 이식 비용을 할인해 준다.',
    },
    arena: {
      name: '지하 격투장',
      description: '무력이 필요하다. 평판을 끌어올린다.',
    },
    datatrafficking: {
      name: '데이터 밀매',
      description: '수입이 가장 높지만 열기도 높다. 해커 배치가 필수다.',
    },
  },

  cyberware: {
    cyber_arm: { name: '사이버 팔', description: '무력을 강화하는 의수.' },
    neural_processor: { name: '신경 프로세서', description: '연산 속도를 높여 기술을 강화한다.' },
    vocal_modulator: { name: '음성 변조기', description: '설득력 있는 목소리로 교섭을 강화한다.' },
    optic_camo: { name: '광학 위장', description: '빛을 굴절시켜 은신을 강화한다.' },
    reflex_booster: { name: '반사신경 부스터', description: '무력과 은신을 동시에 소폭 강화한다.' },
    wetware_suite: { name: '웻웨어 슈트', description: '전신 개조. 모든 능력치를 고르게 올리지만 인간성 손실이 크다.' },
  },

  rivals: {
    gang_a: { name: '레드 파이프' },
    gang_b: { name: '크롬 파이버' },
  },

  legacy: {
    start_credits: { name: '비상 자금', description: '다음 런 시작 크레딧이 늘어난다.' },
    start_extra_crew: { name: '오랜 연줄', description: '다음 런에 조직원 한 명을 더 데리고 시작한다.' },
    start_less_heat: { name: '뒷돈 인맥', description: '다음 런 시작 열기가 줄어든다.' },
    start_prebuild: { name: '선구축 거점', description: '다음 런에 사업 하나를 미리 지어 놓고 시작한다.' },
    start_special_crew: { name: '전설의 소개장', description: '영입 풀에 특별한 조직원이 추가된다.' },
  },

  crew: {
    boss: { name: '보스' },
    crew_01: { name: '락' },
    crew_02: { name: '피즈' },
    crew_r01: { name: '스파크' },
    crew_r02: { name: '타이니' },
    crew_r03: { name: '고스트' },
    crew_r04: { name: '실버통' },
    crew_r05: { name: '닥터 레인' },
    crew_r06: { name: '블레이드' },
    crew_r07: { name: '픽서' },
    crew_r08: { name: '웜홀' },
    crew_r09: { name: '레이저캣' },
    crew_r10: { name: '아이언메이드' },
    crew_r11: { name: '미드나잇' },
    crew_r12: { name: '위도우' },
  },

  events: {
    evt_crackdown_bribe_check: {
      text: '검문 중이던 경관이 갱단 표식을 알아봤다. 슬쩍 눈짓을 보낸다.',
      choice_bribe: '뒷돈을 찔러준다',
      choice_refuse: '모르는 척 지나간다',
    },
    evt_crackdown_patrol_sweep: {
      text: '경찰 순찰이 부쩍 늘었다. 거점 근처를 순찰차가 맴돈다.',
      choice_lay_low: '당분간 몸을 사린다',
      choice_ignore: '평소대로 움직인다',
    },
    evt_crackdown_informant: {
      text: '조직 내부에 정보원이 있다는 소문이 돈다.',
      choice_pay: '입막음 비용을 지불한다',
      choice_silence: '조용히 처리한다',
    },
    evt_crackdown_fine: {
      text: '단속에 걸려 즉결 벌금 고지서를 받았다.',
      choice_pay_fine: '벌금을 낸다',
      choice_dodge: '몸싸움 끝에 도망친다',
    },
    evt_raid_warehouse: {
      text: '기업 진압대가 창고를 급습했다. 총성이 들린다.',
      choice_fight: '맞서 싸운다',
      choice_flee: '물건을 버리고 후퇴한다',
    },
    evt_raid_corp_strike: {
      text: '기업 특수부대가 본격적으로 움직이기 시작했다.',
      choice_defend: '거점을 방어한다',
      choice_bribe_officer: '지휘관에게 뇌물을 시도한다',
    },
    evt_raid_corporate_zone: {
      text: '기업 지구에서 비상 봉쇄령이 떨어졌다.',
      choice_lockdown: '봉쇄가 풀릴 때까지 숨죽인다',
      choice_negotiate: '중개인을 통해 협상한다',
    },
    evt_cyberpsychosis_rampage: {
      text: '이식 부작용으로 조직원 하나가 폭주하기 시작했다.',
      choice_restrain: '힘으로 제압한다',
      choice_let_loose: '일단 내버려 둔다',
    },
    evt_cyberpsychosis_flashback: {
      text: '한 조직원이 과거 이식 수술의 기억에 시달리고 있다.',
      choice_therapy: '치료를 받게 한다',
      choice_ignore: '넘어간다',
    },
    evt_betrayal_leak: {
      text: '조직 정보가 경쟁 갱단에 흘러들어간 흔적을 발견했다.',
      choice_confront: '배신자를 직접 추궁한다',
      choice_buy_silence: '돈으로 입을 막는다',
    },
    evt_betrayal_rival_offer: {
      text: '경쟁 갱단이 조직원 하나에게 은밀히 접촉했다는 소식이 들린다.',
      choice_expose: '조직 전체에 알려 본보기로 삼는다',
      choice_let_it_slide: '일단 넘어간다',
    },
    evt_desertion_threat: {
      text: '급여에 불만을 품은 조직원이 떠나겠다고 으름장을 놓는다.',
      choice_raise_wage: '급여를 올려준다',
      choice_let_go: '붙잡지 않는다',
    },
    evt_desertion_family: {
      text: '한 조직원이 가족 문제로 휴가를 요청한다.',
      choice_grant_leave: '휴가를 허락한다',
      choice_refuse_leave: '거절한다',
    },
    evt_recruit_offer_street: {
      text: '거리에서 실력 있어 보이는 이가 합류를 제안해온다.',
      choice_accept: '받아들인다',
      choice_decline: '거절한다',
    },
    evt_recruit_offer_specialist: {
      text: '평판을 듣고 찾아온 전문가가 영입을 제안한다.',
      choice_accept: '받아들인다',
      choice_decline: '거절한다',
    },
    evt_recruit_offer_defector: {
      text: '경쟁 갱단 출신이라는 자가 망명을 요청한다.',
      choice_accept: '받아들인다',
      choice_decline: '거절한다',
    },
    evt_deal_offer_arms: {
      text: '무기상이 신형 장비 투자를 제안한다.',
      choice_invest: '투자한다',
      choice_pass: '넘긴다',
    },
    evt_deal_offer_data: {
      text: '수상한 데이터 브로커가 대량 거래를 제안한다.',
      choice_accept: '거래를 받아들인다',
      choice_refuse: '거절한다',
    },
    evt_deal_offer_territory: {
      text: '중립 구역 하나를 조용히 넘기겠다는 제안이 들어온다.',
      choice_accept: '값을 치르고 받는다',
      choice_refuse: '거절한다',
    },
    evt_bribe_demand_cop: {
      text: '뒷돈을 노리는 경관이 노골적으로 손을 내민다.',
      choice_pay: '돈을 쥐여준다',
      choice_refuse: '거절한다',
    },
    evt_bribe_demand_official: {
      text: '구청 공무원이 인허가를 미끼로 뒷돈을 요구한다.',
      choice_pay: '요구를 들어준다',
      choice_refuse: '거절한다',
    },
    evt_bribe_demand_rival_lieutenant: {
      text: '경쟁 갱단의 간부가 통행세를 요구하며 접근한다.',
      choice_pay: '통행세를 낸다',
      choice_refuse: '거절한다',
      choice_ambush: '역으로 매복을 건다',
    },
  },
} as const;
