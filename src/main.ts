import { bootstrapApp } from './app';
import { installHostLifecycleBridge } from './host/host-lifecycle';

installHostLifecycleBridge();
bootstrapApp();
