// ubndxanuicam/frontend/src/pages/HandbookPage.jsx
// VERSION 2.1 - ADDED EDIT FUNCTIONALITY

import React, { useState, useEffect, useCallback } from 'react';
import useAuth from '../hooks/useAuth';
import { BookOpen, Plus, Clock, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/apiService';
import { formatDate } from '../utils/formatDate';
import Spinner from '../components/common/Spinner';
import ArticleModal from '../components/articles/ArticleModal';
import ArticleDetailModal from '../components/articles/ArticleDetailModal';
import Notification from '../components/common/Notification';

import DataRepoPage from './DataRepoPage';

export default DataRepoPage;