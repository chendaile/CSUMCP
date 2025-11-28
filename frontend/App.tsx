import logo from "./src/assets/logo.png";

function App() {
        const routes = [
                {
                        title: "教务系统 - 成绩查询",
                        path: "/api/jwc/:id/:pwd/grade?term=",
                },
                {
                        title: "教务系统 - 排名查询",
                        path: "/api/jwc/:id/:pwd/rank",
                },
                {
                        title: "教务系统 - 课表查询",
                        path: "/api/jwc/:id/:pwd/class/:term/:week",
                },
                {
                        title: "教务系统 - 等级考试",
                        path: "/api/jwc/:id/:pwd/levelexam",
                },
                {
                        title: "教务系统 - 学生信息",
                        path: "/api/jwc/:id/:pwd/studentinfo",
                },
                {
                        title: "教务系统 - 培养方案",
                        path: "/api/jwc/:id/:pwd/studentplan",
                },
                {
                        title: "教务系统 - 辅修信息",
                        path: "/api/jwc/:id/:pwd/minorinfo",
                },
                {
                        title: "教务系统 - 汇总信息",
                        path: "/api/jwc/:id/:pwd/summary",
                },
                {
                        title: "图书馆 - 数据库检索",
                        path: "/api/library/dbsearch?elecName=",
                },
                {
                        title: "图书馆 - 图书检索",
                        path: "/api/library/:id/:pwd/booksearch?kw=",
                },
                {
                        title: "图书馆 - 馆藏查询",
                        path: "/api/library/:id/:pwd/bookcopies/:recordId",
                },
                {
                        title: "图书馆 - 座位校区",
                        path: "/api/library/seat/campuses",
                },
                {
                        title: "校园巴士查询",
                        path: "/api/bus?date=&crs01=&crs02=",
                },
        ];

        return (
                <div className="container">
                        <header>
                                <div className="logo-section">
                                        <img
                                                src={logo}
                                                alt="Logo"
                                                className="logo"
                                        />
                                        <h1>CSU MCP Service</h1>
                                </div>
                                <nav>
                                        <a
                                                href="https://github.com/chendaile/CSUMCP"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                        >
                                                GitHub
                                        </a>
                                </nav>
                        </header>

                        <main>
                                <div className="intro">
                                        <p>中南大学CSU API接口.</p>
                                </div>

                                <div className="api-grid">
                                        {routes.map((route, index) => (
                                                <div
                                                        key={index}
                                                        className="card"
                                                >
                                                        <h3>{route.title}</h3>
                                                        <code>
                                                                {route.path}
                                                        </code>
                                                </div>
                                        ))}
                                </div>
                        </main>

                        <footer>
                                <p>
                                        © {new Date().getFullYear()} CSU MCP
                                        Service. All rights reserved.
                                </p>
                        </footer>
                </div>
        );
}

export default App;
