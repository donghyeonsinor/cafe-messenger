// SQLite 데이터 저장소
// better-sqlite3를 사용한 영구 데이터 저장

const Database = require('better-sqlite3')
const path = require('path')
const { app } = require('electron')
const { SCHEMAS, TABLE_COLUMNS } = require('./schema')

class DataStore {
  constructor() {
    this.db = null
    this.initialized = false
  }

  /**
   * 데이터베이스 초기화
   * app.whenReady() 이후에 호출해야 함
   */
  initialize() {
    if (this.initialized) return

    // 앱 데이터 디렉토리에 DB 파일 생성
    const dbPath = path.join(app.getPath('userData'), 'cafe-messenger.db')
    console.log('[Store] Database path:', dbPath)

    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL') // 성능 향상

    // 테이블 생성
    this.initTables()
    this.initialized = true

    console.log('[Store] Database initialized successfully')
  }

  /**
   * 테이블 생성
   */
  initTables() {
    for (const [tableName, schema] of Object.entries(SCHEMAS)) {
      this.db.exec(schema)
      console.log(`[Store] Table '${tableName}' ready`)
    }
  }

  /**
   * 데이터 생성
   * @param {string} table - 테이블 이름
   * @param {object} data - 생성할 데이터
   * @returns {object} 생성된 데이터 (id 포함)
   */
  create(table, data) {
    const columns = TABLE_COLUMNS[table]
    if (!columns) {
      throw new Error(`Unknown table: ${table}`)
    }

    // 데이터에서 해당 테이블의 컬럼만 추출
    const values = {}
    for (const col of columns) {
      if (data[col] !== undefined) {
        values[col] = data[col]
      }
    }

    // created_at 추가
    values.created_at = new Date().toISOString()

    const cols = Object.keys(values)
    const placeholders = cols.map(c => `@${c}`).join(', ')
    const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`

    const stmt = this.db.prepare(sql)
    const result = stmt.run(values)

    // 생성된 레코드 반환
    return this.getById(table, result.lastInsertRowid)
  }

  /**
   * 모든 데이터 조회
   * @param {string} table - 테이블 이름
   * @returns {array} 모든 레코드
   */
  getAll(table) {
    const stmt = this.db.prepare(`SELECT * FROM ${table} ORDER BY id DESC`)
    return stmt.all()
  }

  /**
   * ID로 데이터 조회
   * @param {string} table - 테이블 이름
   * @param {number} id - 레코드 ID
   * @returns {object|null} 레코드 또는 null
   */
  getById(table, id) {
    const stmt = this.db.prepare(`SELECT * FROM ${table} WHERE id = ?`)
    return stmt.get(id) || null
  }

  /**
   * 조건으로 데이터 조회
   * @param {string} table - 테이블 이름
   * @param {function} predicate - 필터 함수
   * @returns {array} 필터링된 레코드들
   */
  find(table, predicate) {
    // 모든 데이터를 가져와서 JS로 필터링
    // (기존 인터페이스 호환성 유지)
    const all = this.getAll(table)
    return all.filter(predicate)
  }

  /**
   * 조건으로 단일 데이터 조회
   * @param {string} table - 테이블 이름
   * @param {object} where - 조건 객체 (예: { naver_id: 'test' })
   * @returns {object|null} 레코드 또는 null
   */
  findOne(table, where) {
    const conditions = Object.keys(where).map(k => `${k} = @${k}`).join(' AND ')
    const sql = `SELECT * FROM ${table} WHERE ${conditions} LIMIT 1`
    const stmt = this.db.prepare(sql)
    return stmt.get(where) || null
  }

  /**
   * 데이터 업데이트
   * @param {string} table - 테이블 이름
   * @param {number} id - 레코드 ID
   * @param {object} updates - 업데이트할 필드
   * @returns {object|null} 업데이트된 레코드 또는 null
   */
  update(table, id, updates) {
    // 기존 레코드 확인
    const existing = this.getById(table, id)
    if (!existing) return null

    // updated_at 추가
    updates.updated_at = new Date().toISOString()

    const setClauses = Object.keys(updates).map(k => `${k} = @${k}`).join(', ')
    const sql = `UPDATE ${table} SET ${setClauses} WHERE id = @id`

    const stmt = this.db.prepare(sql)
    stmt.run({ ...updates, id })

    return this.getById(table, id)
  }

  /**
   * 데이터 삭제
   * @param {string} table - 테이블 이름
   * @param {number} id - 레코드 ID
   * @returns {boolean} 삭제 성공 여부
   */
  delete(table, id) {
    const stmt = this.db.prepare(`DELETE FROM ${table} WHERE id = ?`)
    const result = stmt.run(id)
    return result.changes > 0
  }

  /**
   * 모든 데이터 초기화
   */
  clear() {
    for (const tableName of Object.keys(SCHEMAS)) {
      this.db.exec(`DELETE FROM ${tableName}`)
    }
    console.log('[Store] All tables cleared')
  }

  /**
   * 데이터베이스 연결 종료
   */
  close() {
    if (this.db) {
      this.db.close()
      this.db = null
      this.initialized = false
      console.log('[Store] Database closed')
    }
  }
}

// 싱글톤 인스턴스
const store = new DataStore()

module.exports = store
