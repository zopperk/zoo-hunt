import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './styles.css';
import { PlayerApp } from './player/PlayerApp';
import { HqApp } from './hq/HqApp';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<BrowserRouter>
			<Routes>
				<Route path="/hq/*" element={<HqApp />} />
				<Route path="/*" element={<PlayerApp />} />
			</Routes>
		</BrowserRouter>
	</StrictMode>,
);
