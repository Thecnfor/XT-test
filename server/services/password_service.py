import base64
import hashlib
import secrets
import logging
from typing import Optional, Tuple, Dict, Any
from Crypto.Cipher import AES
from Crypto.Protocol.KDF import PBKDF2
from Crypto.Util.Padding import pad, unpad
from Crypto.Random import get_random_bytes
from fastapi import HTTPException, status

# 配置日志
logger = logging.getLogger(__name__)

class PasswordService:
    """密码处理服务
    
    提供与前端CryptoJS兼容的加密解密功能，以及密码安全处理
    """
    
    def __init__(self, encryption_key: str):
        """
        初始化密码服务
        
        Args:
            encryption_key: 与前端共享的加密密钥
        """
        self.encryption_key = encryption_key.encode('utf-8')
        self.salt_header = b'Salted__'
        
    def decrypt_password(self, encrypted_password: str) -> str:
        """
        解密前端CryptoJS加密的密码
        
        Args:
            encrypted_password: 前端加密后的base64字符串
            
        Returns:
            解密后的原始密码
            
        Raises:
            HTTPException: 解密失败时抛出异常
        """
        try:
            # 解码base64数据
            encrypted_data = base64.b64decode(encrypted_password)
            
            # 验证数据格式
            if len(encrypted_data) < 16 or not encrypted_data.startswith(self.salt_header):
                raise ValueError("无效的加密数据格式")
            
            # 提取salt和密文
            salt = encrypted_data[8:16]
            ciphertext = encrypted_data[16:]
            
            # 生成密钥和IV（与CryptoJS兼容）
            key, iv = self._derive_key_iv(self.encryption_key, salt)
            
            # 解密
            cipher = AES.new(key, AES.MODE_CBC, iv)
            decrypted = unpad(cipher.decrypt(ciphertext), AES.block_size)
            
            password = decrypted.decode('utf-8')
            logger.info("密码解密成功")
            return password
            
        except Exception as e:
            logger.error(f"密码解密失败: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"密码解密失败: {str(e)}"
            )
    
    def encrypt_password(self, password: str, salt: Optional[bytes] = None) -> str:
        """
        使用与CryptoJS兼容的方式加密密码
        
        Args:
            password: 原始密码
            salt: 可选的salt，如果不提供则随机生成
            
        Returns:
            加密后的base64字符串
        """
        try:
            if salt is None:
                salt = get_random_bytes(8)
            
            # 生成密钥和IV
            key, iv = self._derive_key_iv(self.encryption_key, salt)
            
            # 加密
            cipher = AES.new(key, AES.MODE_CBC, iv)
            padded_password = pad(password.encode('utf-8'), AES.block_size)
            ciphertext = cipher.encrypt(padded_password)
            
            # 组合数据：Salted__ + salt + ciphertext
            encrypted_data = self.salt_header + salt + ciphertext
            
            # 返回base64编码
            return base64.b64encode(encrypted_data).decode('utf-8')
            
        except Exception as e:
            logger.error(f"密码加密失败: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"密码加密失败: {str(e)}"
            )
    
    def _derive_key_iv(self, password: bytes, salt: bytes, iterations: int = 1) -> Tuple[bytes, bytes]:
        """
        使用PBKDF2生成密钥和IV（与CryptoJS兼容）
        
        Args:
            password: 密码字节
            salt: 盐值
            iterations: 迭代次数（CryptoJS默认为1）
            
        Returns:
            (key, iv) 元组
        """
        # 生成48字节的密钥材料（32字节密钥 + 16字节IV）
        key_iv = PBKDF2(password, salt, dkLen=48, count=iterations)
        key = key_iv[:32]  # AES-256需要32字节密钥
        iv = key_iv[32:48]  # 16字节IV
        return key, iv
    
    def hash_password(self, password: str, salt: Optional[str] = None) -> Dict[str, str]:
        """
        使用安全的方式哈希密码（用于存储）
        
        Args:
            password: 原始密码
            salt: 可选的盐值
            
        Returns:
            包含哈希值和盐值的字典
        """
        if salt is None:
            salt = secrets.token_hex(32)
        
        # 使用PBKDF2进行多次迭代哈希
        password_hash = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000  # 100,000次迭代
        )
        
        return {
            'hash': password_hash.hex(),
            'salt': salt
        }
    
    def verify_password(self, password: str, stored_hash: str, salt: str) -> bool:
        """
        验证密码是否正确
        
        Args:
            password: 用户输入的密码
            stored_hash: 存储的密码哈希
            salt: 存储的盐值
            
        Returns:
            密码是否正确
        """
        try:
            # 使用相同的方法计算哈希
            password_hash = hashlib.pbkdf2_hmac(
                'sha256',
                password.encode('utf-8'),
                salt.encode('utf-8'),
                100000
            )
            
            # 安全比较哈希值
            return secrets.compare_digest(password_hash.hex(), stored_hash)
            
        except Exception as e:
            logger.error(f"密码验证失败: {e}")
            return False
    
    def validate_password_strength(self, password: str) -> Dict[str, Any]:
        """
        验证密码强度
        
        Args:
            password: 要验证的密码
            
        Returns:
            包含验证结果的字典
        """
        result = {
            'valid': True,
            'score': 0,
            'issues': [],
            'suggestions': []
        }
        
        # 长度检查
        if len(password) < 8:
            result['valid'] = False
            result['issues'].append('密码长度至少需要8个字符')
        elif len(password) >= 12:
            result['score'] += 2
        else:
            result['score'] += 1
        
        # 字符类型检查
        has_lower = any(c.islower() for c in password)
        has_upper = any(c.isupper() for c in password)
        has_digit = any(c.isdigit() for c in password)
        has_special = any(c in '!@#$%^&*()_+-=[]{}|;:,.<>?' for c in password)
        
        char_types = sum([has_lower, has_upper, has_digit, has_special])
        
        if char_types < 3:
            result['valid'] = False
            result['issues'].append('密码需要包含至少3种字符类型（大写字母、小写字母、数字、特殊字符）')
        
        result['score'] += char_types
        
        # 常见密码检查
        common_passwords = [
            '123456', 'password', '123456789', '12345678',
            'qwerty', '123123', '111111', '1234567890'
        ]
        
        if password.lower() in common_passwords:
            result['valid'] = False
            result['issues'].append('不能使用常见密码')
        
        # 重复字符检查
        if len(set(password)) < len(password) * 0.6:
            result['issues'].append('密码包含过多重复字符')
            result['score'] -= 1
        
        # 生成建议
        if not has_upper:
            result['suggestions'].append('添加大写字母')
        if not has_lower:
            result['suggestions'].append('添加小写字母')
        if not has_digit:
            result['suggestions'].append('添加数字')
        if not has_special:
            result['suggestions'].append('添加特殊字符')
        if len(password) < 12:
            result['suggestions'].append('增加密码长度到12个字符以上')
        
        # 计算强度等级
        if result['score'] >= 6:
            result['strength'] = 'strong'
        elif result['score'] >= 4:
            result['strength'] = 'medium'
        else:
            result['strength'] = 'weak'
        
        return result
    
    def generate_secure_password(self, length: int = 16) -> str:
        """
        生成安全的随机密码
        
        Args:
            length: 密码长度
            
        Returns:
            生成的安全密码
        """
        if length < 8:
            length = 8
        
        # 确保包含各种字符类型
        lowercase = 'abcdefghijklmnopqrstuvwxyz'
        uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        digits = '0123456789'
        special = '!@#$%^&*()_+-=[]{}|;:,.<>?'
        
        # 确保至少包含一个每种类型的字符
        password = [
            secrets.choice(lowercase),
            secrets.choice(uppercase),
            secrets.choice(digits),
            secrets.choice(special)
        ]
        
        # 填充剩余长度
        all_chars = lowercase + uppercase + digits + special
        for _ in range(length - 4):
            password.append(secrets.choice(all_chars))
        
        # 随机打乱
        secrets.SystemRandom().shuffle(password)
        
        return ''.join(password)
    
    def create_password_reset_token(self, user_id: str) -> str:
        """
        创建密码重置令牌
        
        Args:
            user_id: 用户ID
            
        Returns:
            重置令牌
        """
        # 生成随机令牌
        token = secrets.token_urlsafe(32)
        
        # 在实际应用中，这里应该将令牌存储到数据库或缓存中
        # 并设置过期时间（例如15分钟）
        logger.info(f"为用户 {user_id} 创建密码重置令牌")
        
        return token
    
    def verify_reset_token(self, token: str, user_id: str) -> bool:
        """
        验证密码重置令牌
        
        Args:
            token: 重置令牌
            user_id: 用户ID
            
        Returns:
            令牌是否有效
        """
        # 在实际应用中，这里应该从数据库或缓存中验证令牌
        # 并检查是否过期
        logger.info(f"验证用户 {user_id} 的密码重置令牌")
        
        # 这里只是示例，实际应该实现真正的验证逻辑
        return len(token) == 43  # token_urlsafe(32) 生成43个字符

# 全局密码服务实例（在实际使用时需要传入正确的加密密钥）
_password_service = None

def get_password_service(encryption_key: str = None) -> PasswordService:
    """
    获取密码服务实例
    
    Args:
        encryption_key: 加密密钥
        
    Returns:
        PasswordService实例
    """
    global _password_service
    
    if _password_service is None and encryption_key:
        _password_service = PasswordService(encryption_key)
    
    if _password_service is None:
        raise ValueError("密码服务未初始化，请提供加密密钥")
    
    return _password_service

def init_password_service(encryption_key: str) -> None:
    """
    初始化全局密码服务
    
    Args:
        encryption_key: 加密密钥
    """
    global _password_service
    _password_service = PasswordService(encryption_key)
    logger.info("密码服务已初始化")