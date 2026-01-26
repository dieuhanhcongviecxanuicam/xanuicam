import { useState, useEffect, useRef } from 'react';
import apiService from '../services/apiService';

// Hook that fetches departments list once and provides a map + getById with caching
export default function useDepartments(opts = { limit: 1000 }) {
  const [departments, setDepartments] = useState([]);
  const cacheRef = useRef({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await apiService.getDepartments(opts);
        const list = Array.isArray(resp) ? resp : (resp && resp.data) ? resp.data : [];
        if (!mounted) return;
        setDepartments(list);
        // seed cache
        const c = {};
        list.forEach(d => { if (d && (d.id || d.id === 0)) c[d.id] = d; });
        cacheRef.current = { ...cacheRef.current, ...c };
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [opts]);

  const departmentsMap = (departments || []).reduce((m, d) => {
    if (!d) return m;
    m[d.id] = d.name || d.department_name || '';
    return m;
  }, {});

  const getDepartmentById = async (id) => {
    if (id === undefined || id === null) return null;
    if (cacheRef.current && cacheRef.current[id]) return cacheRef.current[id];
    try {
      const resp = await apiService.getDepartmentById(id);
      const dept = resp || null;
      if (dept) cacheRef.current[id] = dept;
      return dept;
    } catch (e) {
      return null;
    }
  };

  return { departments, departmentsMap, getDepartmentById };
}
