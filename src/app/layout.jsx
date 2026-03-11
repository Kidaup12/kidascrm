import '../main.css';
import LayoutComponent from '../components/Layout';

export const metadata = {
  title: "Kida's CRM",
  description: "CRM Application",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <LayoutComponent>{children}</LayoutComponent>
      </body>
    </html>
  );
}
