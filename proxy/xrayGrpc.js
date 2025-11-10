const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.join(__dirname, 'proto', 'command.proto');

// Загружаем proto с правильными опциями
const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const grpcObj = grpc.loadPackageDefinition(packageDef);

// Проверим структуру (временно)
if (!grpcObj.xray || !grpcObj.xray.app) {
  console.error('❌ Ошибка: структура proto не соответствует ожиданиям.');
  console.error('Загруженные пакеты:', Object.keys(grpcObj));
  process.exit(1);
}

const handlerService =
  grpcObj.xray.app.proxyman.command.HandlerService;

// Подключаемся к XRay API (порт 9999)
const client = new handlerService(
  '172.26.242.209:62789',
  grpc.credentials.createInsecure()
);

// Добавить пользователя
function addUser(uuid, remark = 'test_user') {
  return new Promise((resolve, reject) => {
    const request = {
      tag: 'api',
      user: {
        email: remark,
        account: {
          id: uuid,
          alterId: '0',
          security: 'auto',
        },
      },
    };

    client.AddUser(request, (err, response) => {
      if (err) {
        console.error('❌ gRPC AddUser error:', err.message);
        reject(err);
      } else {
        console.log(`✅ Added user ${remark} (${uuid})`);
        resolve(response);
      }
    });
  });
}

// Удалить пользователя
function removeUser(remark) {
  return new Promise((resolve, reject) => {
    const request = {
      tag: 'api',
      email: remark,
    };

    client.RemoveUser(request, (err, response) => {
      if (err) {
        console.error('❌ gRPC RemoveUser error:', err.message);
        reject(err);
      } else {
        console.log(`🗑️ Removed user ${remark}`);
        resolve(response);
      }
    });
  });
}

module.exports = { addUser, removeUser };
