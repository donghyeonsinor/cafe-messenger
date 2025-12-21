// In-memory 데이터 저장소
// 나중에 SQLite로 교체 가능하도록 인터페이스 설계

class DataStore {
  constructor() {
    // 각 테이블의 데이터와 자동 증가 ID
    this.data = {
      accounts: [],
      cafes: [],
      templates: [],
      members: []
    };

    this.nextId = {
      accounts: 1,
      cafes: 1,
      templates: 1,
      members: 1
    };
  }

  /**
   * 데이터 생성
   * @param {string} table - 테이블 이름
   * @param {object} data - 생성할 데이터
   * @returns {object} 생성된 데이터 (id 포함)
   */
  create(table, data) {
    const id = this.nextId[table]++;
    const record = {
      id,
      ...data,
      created_at: new Date().toISOString()
    };
    this.data[table].push(record);
    return record;
  }

  /**
   * 모든 데이터 조회
   * @param {string} table - 테이블 이름
   * @returns {array} 모든 레코드
   */
  getAll(table) {
    return [...this.data[table]];
  }

  /**
   * ID로 데이터 조회
   * @param {string} table - 테이블 이름
   * @param {number} id - 레코드 ID
   * @returns {object|null} 레코드 또는 null
   */
  getById(table, id) {
    return this.data[table].find(record => record.id === id) || null;
  }

  /**
   * 조건으로 데이터 조회
   * @param {string} table - 테이블 이름
   * @param {function} predicate - 필터 함수
   * @returns {array} 필터링된 레코드들
   */
  find(table, predicate) {
    return this.data[table].filter(predicate);
  }

  /**
   * 데이터 업데이트
   * @param {string} table - 테이블 이름
   * @param {number} id - 레코드 ID
   * @param {object} updates - 업데이트할 필드
   * @returns {object|null} 업데이트된 레코드 또는 null
   */
  update(table, id, updates) {
    const index = this.data[table].findIndex(record => record.id === id);
    if (index === -1) return null;

    this.data[table][index] = {
      ...this.data[table][index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    return this.data[table][index];
  }

  /**
   * 데이터 삭제
   * @param {string} table - 테이블 이름
   * @param {number} id - 레코드 ID
   * @returns {boolean} 삭제 성공 여부
   */
  delete(table, id) {
    const index = this.data[table].findIndex(record => record.id === id);
    if (index === -1) return false;

    this.data[table].splice(index, 1);
    return true;
  }

  /**
   * 모든 데이터 초기화
   */
  clear() {
    this.data = {
      accounts: [],
      cafes: [],
      templates: [],
      members: []
    };

    this.nextId = {
      accounts: 1,
      cafes: 1,
      templates: 1,
      members: 1
    };
  }
}

// 싱글톤 인스턴스
const store = new DataStore();

module.exports = store;
