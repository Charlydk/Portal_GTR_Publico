// RUTA: src/components/Footer.jsx
import React from 'react';
import { Container } from 'react-bootstrap';
import packageInfo from '../../package.json';

const Footer = () => {
    const currentYear = new Date().getFullYear();
    const version = packageInfo.version;

    return (
        <footer className="mt-auto py-3 bg-light border-top">
            <Container className="text-center">
                <span className="text-muted small">
                    © {currentYear} Portal Workforce | v{version}
                </span>
            </Container>
        </footer>
    );
};

export default Footer;
