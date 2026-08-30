import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './styles.css';
import { PlayerApp } from './player/PlayerApp';
import { HqApp } from './hq/HqApp';

function HqRedirect() {
	const loc = useLocation();
	return <Navigate to={loc.pathname.replace(/^\/hq/, '/admin') + loc.search} replace />;
}

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<BrowserRouter>
			<Routes>
				<Route path="/admin/*" element={<HqApp />} />
				<Route path="/hq/*" element={<HqRedirect />} />
				<Route path="/*" element={<PlayerApp />} />
			</Routes>
		</BrowserRouter>
	</StrictMode>,
);
