const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// Путь до proto-файла
const PROTO_PATH = path.join(__dirname, 'proxy', 'proto', 'command.proto');

// Загружаем определение
const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const grpcObj = grpc.loadPackageDefinition(packageDef);
const handlerService = grpcObj.xray.app.proxyman.command.HandlerService;

// Подключаемся к Xray API
const client = new handlerService(
  '127.0.0.1:9999', // Xray API порт
  grpc.credentials.createInsecure()
);

// Пример нового пользователя
const newUser = {
  tag: "api-in", // поменяй на свой inbound tag, например 'inbound-80'
  user: {
    email: 'new_user@example.com',
    level: 0,
    alterId: 0,
    account: {
      id: 'aabbccdd-eeff-1122-3344-556677889900', // UUID
      flow: '',
      security: 'auto'
    }
  }
};

// ➕ Добавляем пользователя
client.AddUser(newUser, (err, res) => {
  if (err) {
    console.error('❌ Ошибка при добавлении пользователя:', err.message);
  } else {
    console.log('✅ Пользователь добавлен:', res);
  }
});