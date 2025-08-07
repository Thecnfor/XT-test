export default function Login() {
    return (
        <div>
            <h1>登录</h1>
            <form>
                <div>
                    <label>用户名</label>
                    <input type="text" name="username" />
                </div>
                <div>
                    <label>密码</label>
                    <input type="password" name="password" />
                </div>
                <button type="submit">登录</button>
            </form>
        </div>
    );
}