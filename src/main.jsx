import { render } from 'preact';
import 'bootstrap/dist/css/bootstrap.min.css';
import { App } from './App';
import './index.css'; // Optional: for any global custom styles

// Ensure there's an element with id="app" in your panel's HTML
render(<App />, document.getElementById('app')); 