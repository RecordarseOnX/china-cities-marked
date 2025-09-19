// migrate-users.cjs
const { createClient } = require('@supabase/supabase-js');

// --- ⬇️ 请在这里填入你的信息 ⬇️ ---
const SUPABASE_URL = 'https://tdnyawrsgbtejywuysft.supabase.co'; // 在 API 设置页面可以找到
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkbnlhd3JzZ2J0ZWp5d3V5c2Z0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODg4NDY4MiwiZXhwIjoyMDY0NDYwNjgyfQ.hrAqcm5joTSxwYt0OI3duaWh4FV8wuzpA7e3DrQR6mo'; // 把它粘贴在这里
// --- ⬆️ 请在这里填入你的信息 ⬆️ ---

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const DUMMY_PASSWORD = 'a-very-secure-password-for-this-app';

// 【核心修改】将用户名转换为 Base64，以创建合法的邮箱地址
const createDummyEmail = (username) => {
  const base64Username = Buffer.from(username).toString('base64');
  return `${base64Username}@example.com`;
};

async function migrateUsers() {
  console.log('开始迁移用户...');

  try {
    const { data: oldUsers, error: fetchError } = await supabase
      .from('users')
      .select('username');
      
    if (fetchError) throw fetchError;
    if (!oldUsers || oldUsers.length === 0) {
      console.log('✅ 在旧的 users 表中没有找到用户，无需迁移。');
      return;
    }

    console.log(`找到了 ${oldUsers.length} 个用户需要迁移...`);
    let successCount = 0;
    let failCount = 0;

    for (const user of oldUsers) {
      const username = user.username;
      const email = createDummyEmail(username);

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        password: DUMMY_PASSWORD,
        user_metadata: { username: username },
        email_confirm: true,
      });

      if (createError) {
        // 如果错误是因为用户已存在，我们也算作成功，以防重复运行脚本
        if (createError.message.includes('Email address already in use')) {
            console.log(`🟡 用户 "${username}" 已存在，跳过。`);
            successCount++;
        } else {
            console.error(`❌ 迁移用户 "${username}" 失败:`, createError.message);
            failCount++;
        }
      } else {
        console.log(`✅ 成功迁移用户: "${username}"`);
        successCount++;
      }
    }

    console.log('\n--- 迁移完成 ---');
    console.log(`成功: ${successCount}`);
    console.log(`失败: ${failCount}`);

  } catch (error) {
    console.error('迁移过程中发生严重错误:', error.message);
  }
}

migrateUsers();