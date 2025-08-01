// 存储AI数据的hook

// 定义消息类型
interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: number;
}

// 初始数据
const initialData = {
  dataChat: '你好',
  userInputs: [] as string[],
  messages: [] as Message[]
};

// 简单的状态管理
let aiData = { ...initialData };

// 重置数据到初始状态
const resetAiData = () => {
  aiData = { ...initialData };
};

// 更新数据聊天内容
const updateDataChat = (newData: string) => {
  aiData.dataChat = newData;
};

// 添加用户输入
const addUserInput = (input: string) => {
  aiData.userInputs.push(input);
};

// 添加消息到对话历史
const addMessage = (content: string, sender: 'user' | 'ai') => {
  const message: Message = {
    id: Date.now().toString(),
    content,
    sender,
    timestamp: Date.now()
  };
  aiData.messages.push(message);
};

// 获取当前数据
const getAiData = () => {
  return { ...aiData };
};

export {
  resetAiData,
  updateDataChat,
  addUserInput,
  getAiData,
  addMessage
};