// 회원 관리 IPC 핸들러

const store = require('../store');

/**
 * IPC 핸들러 등록
 */
function register(ipcMain) {
  // 모든 회원 조회
  ipcMain.handle('members:getAll', async () => {
    try {
      return store.getAll('members');
    } catch (error) {
      console.error('[IPC] members:getAll error:', error);
      throw error;
    }
  });

  // 특정 카페 회원 조회
  ipcMain.handle('members:getByCafe', async (event, cafeId) => {
    try {
      return store.find('members', member => member.cafe_id === cafeId);
    } catch (error) {
      console.error('[IPC] members:getByCafe error:', error);
      throw error;
    }
  });

  // 회원 생성
  ipcMain.handle('members:create', async (event, data) => {
    try {
      const { cafe_id, nickname, user_id } = data;

      // 유효성 검사
      if (!cafe_id || !nickname) {
        throw new Error('카페 ID와 닉네임은 필수입니다');
      }

      // 중복 확인
      const existing = store.find('members', member =>
        member.cafe_id === cafe_id && member.nickname === nickname
      );
      if (existing.length > 0) {
        throw new Error('이미 등록된 회원입니다');
      }

      // 회원 생성
      const member = store.create('members', {
        cafe_id,
        nickname,
        user_id: user_id || null
      });

      console.log(`[IPC] Created member: ${nickname} (cafe: ${cafe_id})`);
      return member;
    } catch (error) {
      console.error('[IPC] members:create error:', error);
      throw error;
    }
  });

  // 회원 업데이트
  ipcMain.handle('members:update', async (event, id, data) => {
    try {
      const member = store.update('members', id, data);
      if (!member) {
        throw new Error('회원을 찾을 수 없습니다');
      }

      console.log(`[IPC] Updated member: ${member.nickname}`);
      return member;
    } catch (error) {
      console.error('[IPC] members:update error:', error);
      throw error;
    }
  });

  // 회원 삭제
  ipcMain.handle('members:delete', async (event, id) => {
    try {
      const success = store.delete('members', id);
      if (!success) {
        throw new Error('회원을 찾을 수 없습니다');
      }

      console.log(`[IPC] Deleted member: ${id}`);
      return { success: true };
    } catch (error) {
      console.error('[IPC] members:delete error:', error);
      throw error;
    }
  });

  console.log('[IPC] Member handlers registered');
}

module.exports = { register };
