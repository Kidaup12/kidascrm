export default function Header({ title, children }) {
    return (
        <header className="page-header tapestry-header">
            <h1 className="page-title">{title}</h1>
            <div className="page-actions">
                {children}
            </div>
        </header>
    );
}
