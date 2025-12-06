'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface Student {
    id?: number;
    name: string;
    gender: 'M' | 'F';
    is_problem_student: boolean;
    is_special_class: boolean;
    group_name: string;
    rank: number | null;
    previous_section?: number | null;
}

interface ClassData {
    id: number;
    grade: number;
    section_count: number;
    is_distributed?: number;
    parent_class_id?: number;
    child_class_id?: number;
}

export default function StudentsPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const classId = searchParams.get('classId');
    const currentSection = parseInt(searchParams.get('section') || '1');

    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(false);
    const [classData, setClassData] = useState<ClassData | null>(null);
    const [parentClassData, setParentClassData] = useState<ClassData | null>(null);
    const [childClassData, setChildClassData] = useState<ClassData | null>(null);
    const [isPasting, setIsPasting] = useState(false);
    const [showDistributeModal, setShowDistributeModal] = useState(false);
    const [newSectionCount, setNewSectionCount] = useState<number>(2);
    const [distributionPreview, setDistributionPreview] = useState<any>(null);
    const [showStudentListModal, setShowStudentListModal] = useState(false);

    useEffect(() => {
        if (!classId) return;
        loadClassData();
    }, [classId]);

    useEffect(() => {
        if (!classId || !currentSection) return;
        loadStudents();
    }, [classId, currentSection]);

    const loadClassData = async () => {
        try {
            const response = await fetch(`/api/classes/${classId}`);
            const data = await response.json();
            setClassData(data);

            // 현재 클래스가 child class인 경우 (반편성된 클래스)
            if (data.parent_class_id) {
                try {
                    const parentResponse = await fetch(`/api/classes/${data.parent_class_id}`);
                    if (parentResponse.ok) {
                        const parentData = await parentResponse.json();
                        setParentClassData(parentData);
                        setChildClassData(data);
                    } else {
                        // Parent class가 존재하지 않으면 일반 클래스로 처리
                        console.warn(`Parent class ${data.parent_class_id} not found, treating as normal class`);
                        setParentClassData(null);
                        setChildClassData(null);
                    }
                } catch (error) {
                    console.error('Error loading parent class:', error);
                    setParentClassData(null);
                    setChildClassData(null);
                }
            }
            // 현재 클래스가 parent class인 경우 (기존반)
            else if (data.child_class_id) {
                try {
                    const childResponse = await fetch(`/api/classes/${data.child_class_id}`);
                    if (childResponse.ok) {
                        const childData = await childResponse.json();
                        setParentClassData(data);
                        setChildClassData(childData);
                    } else {
                        // Child class가 존재하지 않으면 일반 클래스로 처리
                        console.warn(`Child class ${data.child_class_id} not found, treating as normal class`);
                        setParentClassData(null);
                        setChildClassData(null);
                    }
                } catch (error) {
                    console.error('Error loading child class:', error);
                    setParentClassData(null);
                    setChildClassData(null);
                }
            }
            // 반편성이 없는 일반 클래스
            else {
                setParentClassData(null);
                setChildClassData(null);
            }
        } catch (error) {
            console.error('Error loading class data:', error);
        }
    };

    const loadStudents = async () => {
        try {
            const response = await fetch(`/api/students?classId=${classId}&section=${currentSection}`);
            const data = await response.json();
            if (data.length > 0) {
                setStudents(data.map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    gender: s.gender,
                    is_problem_student: Boolean(s.is_problem_student),
                    is_special_class: Boolean(s.is_special_class),
                    group_name: s.group_name || '',
                    rank: s.rank || null,
                    previous_section: s.previous_section || null,
                })));
            } else {
                setStudents([createEmptyStudent()]);
            }
        } catch (error) {
            console.error('Error loading students:', error);
            setStudents([createEmptyStudent()]);
        }
    };

    const createEmptyStudent = (): Student => ({
        name: '',
        gender: 'M',
        is_problem_student: false,
        is_special_class: false,
        group_name: '',
        rank: null,
        previous_section: null,
    });

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        setIsPasting(true);

        const pastedData = e.clipboardData.getData('text');
        const rows = pastedData.split('\n').filter(row => row.trim());

        const newStudents: Student[] = rows.map(row => {
            const cols = row.split('\t');

            // 성별 파싱: F/f/여/여자 → 'F', M/m/남/남자 → 'M'
            const genderValue = cols[1]?.trim().toUpperCase();
            let gender: 'M' | 'F' = 'M';
            if (genderValue === 'F' || cols[1]?.trim() === '여' || cols[1]?.trim() === '여자') {
                gender = 'F';
            } else if (genderValue === 'M' || cols[1]?.trim() === '남' || cols[1]?.trim() === '남자') {
                gender = 'M';
            }

            // 등수 파싱: 숫자가 아닌 모든 문자 제거
            const rankValue = cols[5]?.replace(/\D/g, '') || '';
            const rankNum = parseInt(rankValue, 10);

            // 그룹 파싱: "1" → "그룹1", "그룹 1" → "그룹1"
            let groupValue = cols[4]?.trim() || '';
            if (/^\d+$/.test(groupValue)) {
                groupValue = `그룹${groupValue}`;
            } else if (groupValue) {
                groupValue = groupValue.replace(/\s/g, '');
            }
            const validGroups = ['그룹1', '그룹2', '그룹3', '그룹4', '그룹5', '그룹6', '그룹7', '그룹8', '그룹9', '그룹10'];
            const finalGroup = validGroups.includes(groupValue) ? groupValue : '';

            return {
                name: cols[0]?.trim() || '',
                gender: gender,
                is_problem_student: cols[2]?.toLowerCase() === 'true' || cols[2] === '1' || cols[2] === '문제',
                is_special_class: cols[3]?.toLowerCase() === 'true' || cols[3] === '1' || cols[3] === '특수',
                group_name: finalGroup,
                rank: !isNaN(rankNum) && rankValue ? rankNum : null,
            };
        });

        setStudents(newStudents);

        setTimeout(() => setIsPasting(false), 1000);
    };

    const downloadTemplate = () => {
        const template = '이름\t성별\t문제아\t특수반\t그룹\t등수\n홍길동\t남\tfalse\tfalse\tA조\t1\n김영희\t여\tfalse\ttrue\tB조\t2\n이철수\t남\ttrue\tfalse\tA조\t3';
        const blob = new Blob([template], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${classData?.grade}학년_${currentSection}반_명렬표_템플릿.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const addRow = () => {
        setStudents([...students, createEmptyStudent()]);
    };

    const removeRow = (index: number) => {
        setStudents(students.filter((_, i) => i !== index));
    };

    const updateStudent = (index: number, field: keyof Student, value: any) => {
        const updated = [...students];
        updated[index] = { ...updated[index], [field]: value };
        setStudents(updated);
    };

    // 개별 필드 붙여넣기 핸들러
    const handleFieldPaste = (e: React.ClipboardEvent<HTMLInputElement | HTMLSelectElement>, startIndex: number, field: keyof Student) => {
        e.preventDefault();
        e.stopPropagation(); // 부모의 handlePaste 실행 방지
        const pastedData = e.clipboardData.getData('text');
        const rows = pastedData.split('\n').filter(v => v.trim());

        console.log('[붙여넣기] 필드:', field, '시작 인덱스:', startIndex);
        console.log('[붙여넣기] 데이터:', pastedData);
        console.log('[붙여넣기] 행 개수:', rows.length);

        if (rows.length === 0) return;

        const updated = [...students];

        // 필드 순서 정의
        const fieldOrder: (keyof Student)[] = ['name', 'gender', 'is_problem_student', 'is_special_class', 'group_name', 'rank'];
        const startFieldIndex = fieldOrder.indexOf(field);

        console.log('[붙여넣기] 필드 순서 인덱스:', startFieldIndex);

        if (startFieldIndex === -1) return; // 필드를 찾을 수 없음

        // 각 행 처리
        rows.forEach((row, rowIndex) => {
            const targetRowIndex = startIndex + rowIndex;
            const cols = row.split('\t');

            // 행이 부족하면 추가
            while (updated.length <= targetRowIndex) {
                updated.push(createEmptyStudent());
            }

            // 각 열 처리 (커서 위치부터 시작)
            cols.forEach((value, colIndex) => {
                const targetFieldIndex = startFieldIndex + colIndex;
                if (targetFieldIndex >= fieldOrder.length) return; // 범위 초과

                const targetField = fieldOrder[targetFieldIndex];
                const trimmedValue = value.trim();

                console.log(`[붙여넣기] 행 ${targetRowIndex}, 열 ${colIndex}: ${targetField} = "${trimmedValue}"`);

                // 필드 타입에 따라 값 변환
                if (targetField === 'rank') {
                    // 숫자가 아닌 모든 문자 제거 (공백, 특수문자 등)
                    const cleanValue = trimmedValue.replace(/\D/g, '');
                    const numValue = parseInt(cleanValue, 10);
                    updated[targetRowIndex].rank = !isNaN(numValue) && cleanValue ? numValue : null;
                } else if (targetField === 'gender') {
                    const genderValue = trimmedValue.toUpperCase();
                    if (genderValue === 'F' || trimmedValue === '여' || trimmedValue === '여자') {
                        updated[targetRowIndex].gender = 'F';
                    } else {
                        updated[targetRowIndex].gender = 'M';
                    }
                } else if (targetField === 'is_problem_student') {
                    updated[targetRowIndex].is_problem_student =
                        trimmedValue.toLowerCase() === 'true' ||
                        trimmedValue === '1' ||
                        trimmedValue === '문제';
                } else if (targetField === 'is_special_class') {
                    updated[targetRowIndex].is_special_class =
                        trimmedValue.toLowerCase() === 'true' ||
                        trimmedValue === '1' ||
                        trimmedValue === '특수';
                } else if (targetField === 'name') {
                    updated[targetRowIndex].name = trimmedValue;
                } else if (targetField === 'group_name') {
                    // 그룹 값 정규화: "1" → "그룹1", "그룹 1" → "그룹1"
                    let groupValue = trimmedValue;
                    if (/^\d+$/.test(trimmedValue)) {
                        // 숫자만 있으면 "그룹" 접두사 추가
                        groupValue = `그룹${trimmedValue}`;
                    } else if (trimmedValue) {
                        // "그룹 1" → "그룹1" (공백 제거)
                        groupValue = trimmedValue.replace(/\s/g, '');
                    }
                    // 유효한 옵션인지 확인 (그룹1~그룹10)
                    const validGroups = ['그룹1', '그룹2', '그룹3', '그룹4', '그룹5', '그룹6', '그룹7', '그룹8', '그룹9', '그룹10'];
                    updated[targetRowIndex].group_name = validGroups.includes(groupValue) ? groupValue : '';
                }
            });
        });

        setStudents(updated);
        setIsPasting(true);
        setTimeout(() => setIsPasting(false), 1000);
    };

    const handleSave = async () => {
        const validStudents = students.filter(s => s.name.trim());

        if (validStudents.length === 0) {
            alert('최소 한 명의 학생 정보를 입력해주세요.');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    classId,
                    section: currentSection,
                    students: validStudents,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Server error:', errorData);
                throw new Error(errorData.error || 'Failed to save students');
            }

            const result = await response.json();
            console.log('Save successful:', result);
            alert('학생 정보가 저장되었습니다!');
            loadStudents();
        } catch (error) {
            console.error('Error:', error);
            alert(`저장 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        } finally {
            setLoading(false);
        }
    };

    const navigateToSection = (section: number) => {
        router.push(`/students?classId=${classId}&section=${section}`);
    };

    const handleDistribute = async () => {
        if (!classId || !newSectionCount || newSectionCount < 2) {
            alert('반 수는 최소 2개 이상이어야 합니다.');
            return;
        }

        const schoolId = localStorage.getItem('schoolId');
        if (!schoolId) {
            alert('로그인이 필요합니다.');
            router.push('/login');
            return;
        }

        const confirmed = confirm(`현재 학급의 모든 학생을 ${newSectionCount}개 반으로 편성하시겠습니까?`);
        if (!confirmed) return;

        setLoading(true);
        setShowDistributeModal(false);

        try {
            const response = await fetch('/api/classes/distribute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    classId,
                    newSectionCount,
                    schoolId: parseInt(schoolId)
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to distribute students');
            }

            const result = await response.json();

            // Store the distribution result for preview
            setDistributionPreview(result);

            // Show success message
            alert(`반편성 분석이 완료되었습니다!\n\n${result.stats.map((s: any) =>
                `${s.section}반: 총 ${s.total}명 (남 ${s.male}, 여 ${s.female}, 문제아 ${s.problem}, 특수반 ${s.special})`
            ).join('\n')}\n\n아래에서 반편성 규칙을 확인하고 "최종적으로 반편성하기" 버튼을 눌러주세요.`);
        } catch (error) {
            console.error('Error:', error);
            alert(`반편성 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleFinalizeDistribution = async () => {
        if (!distributionPreview) return;

        const confirmed = confirm('최종적으로 반편성을 확정하시겠습니까?\n새로운반으로 이동합니다.');
        if (!confirmed) return;

        setLoading(true);

        try {
            const schoolId = localStorage.getItem('schoolId');

            // Update parent class to link to child class
            const updateResponse = await fetch('/api/classes/link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    parentClassId: classId,
                    childClassId: distributionPreview.newClassId,
                    schoolId: parseInt(schoolId!)
                }),
            });

            if (!updateResponse.ok) {
                throw new Error('Failed to finalize distribution');
            }

            alert('반편성이 최종 확정되었습니다!');

            // Navigate to the new class
            router.push(`/students?classId=${distributionPreview.newClassId}&section=1`);
        } catch (error) {
            console.error('Error:', error);
            alert(`반편성 확정 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteDistributedClass = async () => {
        if (!childClassData) {
            alert('삭제할 새로운반이 없습니다.');
            return;
        }

        const confirmed = confirm(
            `새로운반 전체를 삭제하시겠습니까?\n\n` +
            `삭제 대상:\n` +
            `- ${classData?.grade}학년 새로운반 (${childClassData.section_count}개 반: 1반~${childClassData.section_count}반)\n` +
            `- 모든 반의 학생 데이터\n\n` +
            `삭제 후 기존반으로 돌아가며, 이 작업은 되돌릴 수 없습니다.`
        );
        if (!confirmed) return;

        setLoading(true);

        try {
            const schoolId = localStorage.getItem('schoolId');
            const response = await fetch(`/api/classes?classId=${childClassData.id}&schoolId=${schoolId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete class');
            }

            alert(`새로운반 전체(${childClassData.section_count}개 반)가 삭제되었습니다.\n대시보드로 돌아갑니다.`);

            // 대시보드로 이동
            router.push('/dashboard');
        } catch (error) {
            console.error('Error:', error);
            alert(error instanceof Error ? error.message : '새로운반 삭제 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    if (!classId) {
        return (
            <div className="container">
                <div className="card">
                    <p>잘못된 접근입니다. 메인 페이지에서 학년과 반 수를 먼저 입력해주세요.</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            {/* Sidebar */}
            <div className="sidebar">
                <div className="sidebar-header">
                    <h3>{classData?.grade}학년</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        {classData?.is_distributed ? '✨ 편성 완료' : '반 목록'}
                    </p>
                </div>
                <div className="sidebar-sections">
                    {/* 기존반 (원본 클래스) */}
                    {parentClassData && (
                        <>
                            <div style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', color: '#999', fontWeight: 'bold' }}>
                                기존반
                            </div>
                            {[...Array(parentClassData.section_count)].map((_, i) => (
                                <button
                                    key={`parent-${i}`}
                                    className={`section-btn ${classId === String(parentClassData.id) && currentSection === i + 1 ? 'active' : ''}`}
                                    onClick={() => router.push(`/students?classId=${parentClassData.id}&section=${i + 1}`)}
                                >
                                    <span className="section-number">{i + 1}</span>
                                    <span className="section-label">반</span>
                                </button>
                            ))}
                        </>
                    )}

                    {/* 중간 확인 섹션 - 반편성 규칙 설명 */}
                    {distributionPreview && !childClassData && (
                        <div style={{
                            margin: '1.5rem 1rem',
                            padding: '1.5rem',
                            background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
                            border: '2px solid #667eea',
                            borderRadius: '12px'
                        }}>
                            <div style={{
                                fontSize: '0.9rem',
                                fontWeight: 'bold',
                                color: '#667eea',
                                marginBottom: '1rem',
                                textAlign: 'center'
                            }}>
                                ✨ 반편성 규칙 적용 완료
                            </div>
                            <div style={{
                                fontSize: '0.85rem',
                                color: '#555',
                                lineHeight: '1.6',
                                marginBottom: '1rem'
                            }}>
                                <div style={{ marginBottom: '0.5rem' }}>
                                    ✓ <strong>문제아 학생</strong>을 최대한 모이지 않게 분산 배치
                                </div>
                                <div style={{ marginBottom: '0.5rem' }}>
                                    ✓ <strong>특수반 학생</strong>은 인원수가 적은 반에 우선 배치
                                </div>
                                <div style={{ marginBottom: '0.5rem' }}>
                                    ✓ <strong>같은 그룹</strong> 학생들을 서로 다른 반으로 분리
                                </div>
                                <div>
                                    ✓ <strong>성별 및 등수</strong>를 고려하여 균등 분배
                                </div>
                            </div>
                            <button
                                onClick={() => setShowStudentListModal(true)}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    background: '#fff',
                                    color: '#667eea',
                                    border: '2px solid #667eea',
                                    borderRadius: '8px',
                                    fontSize: '0.85rem',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    marginBottom: '0.75rem'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#667eea';
                                    e.currentTarget.style.color = 'white';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#fff';
                                    e.currentTarget.style.color = '#667eea';
                                }}
                            >
                                📋 학생 배치 상세보기
                            </button>
                            <button
                                onClick={handleFinalizeDistribution}
                                disabled={loading}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '0.9rem',
                                    fontWeight: 'bold',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s',
                                    opacity: loading ? 0.6 : 1
                                }}
                                onMouseEnter={(e) => {
                                    if (!loading) e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                {loading ? '처리 중...' : '🎯 최종적으로 반편성하기'}
                            </button>
                        </div>
                    )}

                    {/* 새로운반 (편성된 클래스) */}
                    {childClassData && (
                        <>
                            <div style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', color: '#667eea', fontWeight: 'bold', marginTop: '1rem' }}>
                                새로운반
                            </div>
                            {[...Array(childClassData.section_count)].map((_, i) => (
                                <button
                                    key={`child-${i}`}
                                    className={`section-btn ${classId === String(childClassData.id) && currentSection === i + 1 ? 'active' : ''}`}
                                    onClick={() => router.push(`/students?classId=${childClassData.id}&section=${i + 1}`)}
                                    style={{
                                        background: currentSection === i + 1 && classId === String(childClassData.id) ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'var(--card-bg)',
                                        border: '2px solid #667eea'
                                    }}
                                >
                                    <span className="section-number">{i + 1}</span>
                                    <span className="section-label">반</span>
                                </button>
                            ))}
                        </>
                    )}

                    {/* 일반 클래스 (반편성 없음) */}
                    {!parentClassData && !childClassData && classData && (
                        <>
                            {!distributionPreview && (
                                <>
                                    {[...Array(classData.section_count)].map((_, i) => (
                                        <button
                                            key={`normal-${i}`}
                                            className={`section-btn ${currentSection === i + 1 ? 'active' : ''}`}
                                            onClick={() => navigateToSection(i + 1)}
                                        >
                                            <span className="section-number">{i + 1}</span>
                                            <span className="section-label">반</span>
                                        </button>
                                    ))}
                                </>
                            )}
                            {distributionPreview && (
                                <>
                                    <div style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', color: '#999', fontWeight: 'bold' }}>
                                        기존반
                                    </div>
                                    {[...Array(classData.section_count)].map((_, i) => (
                                        <button
                                            key={`normal-${i}`}
                                            className={`section-btn ${currentSection === i + 1 ? 'active' : ''}`}
                                            onClick={() => navigateToSection(i + 1)}
                                        >
                                            <span className="section-number">{i + 1}</span>
                                            <span className="section-label">반</span>
                                        </button>
                                    ))}
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="main-content fade-in">
                <div className="container">
                    <div className="card">
                        <h1>{classData?.grade}학년 {currentSection}반 학생 정보</h1>

                        <div style={{
                            background: 'var(--card-bg)',
                            border: '2px dashed var(--primary-color)',
                            borderRadius: '12px',
                            padding: '1.5rem',
                            marginBottom: '2rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                <span style={{ fontSize: '1.5rem' }}>📋</span>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>엑셀 붙여넣기 가능</h3>
                                    <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                        엑셀에서 복사 후 아래 표에 <strong>Ctrl+V</strong>로 붙여넣기 하거나, 직접 입력할 수 있습니다.
                                    </p>
                                </div>
                                <button
                                    className="btn btn-secondary"
                                    onClick={downloadTemplate}
                                    style={{ whiteSpace: 'nowrap' }}
                                >
                                    📥 템플릿 다운로드
                                </button>
                            </div>
                            <small style={{ color: 'var(--text-muted)' }}>
                                <strong>형식:</strong> 이름 | 성별(남/여 또는 M/F) | 문제아(true/false/문제) | 특수반(true/false/특수) | 그룹 | 등수
                            </small>
                        </div>

                        {isPasting && (
                            <div style={{
                                background: 'var(--success-color)',
                                color: 'white',
                                padding: '1rem',
                                borderRadius: '8px',
                                marginBottom: '1rem',
                                textAlign: 'center',
                                animation: 'fadeIn 0.3s'
                            }}>
                                ✅ 데이터가 붙여넣기 되었습니다!
                            </div>
                        )}

                        <div className="table-container" onPaste={handlePaste}>
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: '30px' }}>#</th>
                                        {!!classData?.is_distributed && (
                                            <th style={{ width: '80px' }}>이전반</th>
                                        )}
                                        <th>이름</th>
                                        <th style={{ width: '120px' }}>성별</th>
                                        <th style={{ width: '120px' }}>문제아</th>
                                        <th style={{ width: '120px' }}>특수반</th>
                                        <th style={{ width: '150px' }}>그룹</th>
                                        <th style={{ width: '100px' }}>등수</th>
                                        <th style={{ width: '100px' }}>작업</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map((student, index) => (
                                        <tr key={index}>
                                            <td>{index + 1}</td>
                                            {!!classData?.is_distributed && (
                                                <td style={{
                                                    textAlign: 'center',
                                                    fontWeight: 'bold',
                                                    color: '#999',
                                                    fontSize: '0.9rem'
                                                }}>
                                                    {student.previous_section ? `${student.previous_section}반` : '-'}
                                                </td>
                                            )}
                                            <td>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={student.name}
                                                    onChange={(e) => updateStudent(index, 'name', e.target.value)}
                                                    onPaste={(e) => handleFieldPaste(e, index, 'name')}
                                                    placeholder="학생 이름"
                                                    style={{ margin: 0 }}
                                                />
                                            </td>
                                            <td>
                                                <select
                                                    className="form-select"
                                                    value={student.gender}
                                                    onChange={(e) => updateStudent(index, 'gender', e.target.value)}
                                                    onPaste={(e) => handleFieldPaste(e as any, index, 'gender')}
                                                    style={{ margin: 0 }}
                                                >
                                                    <option value="M">남</option>
                                                    <option value="F">여</option>
                                                </select>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={student.is_problem_student}
                                                    onChange={(e) => updateStudent(index, 'is_problem_student', e.target.checked)}
                                                />
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={student.is_special_class}
                                                    onChange={(e) => updateStudent(index, 'is_special_class', e.target.checked)}
                                                />
                                            </td>
                                            <td>
                                                <select
                                                    className="form-select"
                                                    value={student.group_name}
                                                    onChange={(e) => updateStudent(index, 'group_name', e.target.value)}
                                                    onPaste={(e) => handleFieldPaste(e as any, index, 'group_name')}
                                                    style={{ margin: 0 }}
                                                >
                                                    <option value="">선택 안함</option>
                                                    <option value="그룹1">그룹1</option>
                                                    <option value="그룹2">그룹2</option>
                                                    <option value="그룹3">그룹3</option>
                                                    <option value="그룹4">그룹4</option>
                                                    <option value="그룹5">그룹5</option>
                                                    <option value="그룹6">그룹6</option>
                                                    <option value="그룹7">그룹7</option>
                                                    <option value="그룹8">그룹8</option>
                                                    <option value="그룹9">그룹9</option>
                                                    <option value="그룹10">그룹10</option>
                                                </select>
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    className="form-input"
                                                    value={student.rank || ''}
                                                    onChange={(e) => {
                                                        const cleanValue = e.target.value.replace(/\D/g, '');
                                                        const numValue = parseInt(cleanValue, 10);
                                                        updateStudent(index, 'rank', !isNaN(numValue) && cleanValue ? numValue : null);
                                                    }}
                                                    onPaste={(e) => handleFieldPaste(e, index, 'rank')}
                                                    placeholder="등수"
                                                    style={{ margin: 0 }}
                                                />
                                            </td>
                                            <td>
                                                <button
                                                    className="btn btn-danger"
                                                    onClick={() => removeRow(index)}
                                                    style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                                                >
                                                    삭제
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                            <button className="btn btn-secondary" onClick={addRow}>
                                + 행 추가
                            </button>
                            <button
                                className="btn"
                                onClick={() => setShowDistributeModal(true)}
                                style={{
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    border: 'none'
                                }}
                            >
                                🔀 반편성
                            </button>
                            {childClassData && (
                                <button
                                    className="btn"
                                    onClick={handleDeleteDistributedClass}
                                    disabled={loading}
                                    style={{
                                        background: '#dc3545',
                                        color: 'white',
                                        border: 'none'
                                    }}
                                    title={`새로운반 전체(${childClassData.section_count}개 반)를 삭제하고 기존반으로 돌아갑니다`}
                                >
                                    🗑️ 새로운반 전체 삭제
                                </button>
                            )}
                            <button
                                className="btn btn-success"
                                onClick={handleSave}
                                disabled={loading}
                                style={{ marginLeft: 'auto' }}
                            >
                                {loading ? (
                                    <>
                                        <span className="loading"></span>
                                        <span>저장 중...</span>
                                    </>
                                ) : (
                                    '저장'
                                )}
                            </button>
                        </div>

                        {/* 반편성 모달 */}
                        {showDistributeModal && (
                            <div style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0, 0, 0, 0.5)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 1000
                            }}>
                                <div style={{
                                    background: 'white',
                                    padding: '2rem',
                                    borderRadius: '12px',
                                    maxWidth: '500px',
                                    width: '90%'
                                }}>
                                    <h2 style={{ marginTop: 0, color: '#667eea' }}>🔀 반편성</h2>
                                    <p style={{ color: '#666', marginBottom: '1.5rem' }}>
                                        현재 학급의 모든 학생을 새로운 반으로 편성합니다.<br />
                                        등수, 성별, 그룹, 문제아, 특수반을 고려하여 균등하게 배치됩니다.
                                    </p>

                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                                            새로운 반 수
                                        </label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={newSectionCount}
                                            onChange={(e) => setNewSectionCount(parseInt(e.target.value) || 2)}
                                            min="2"
                                            max="20"
                                            style={{ width: '100%' }}
                                        />
                                        <small style={{ color: '#999' }}>2개 ~ 20개 반으로 편성 가능합니다.</small>
                                    </div>

                                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => setShowDistributeModal(false)}
                                        >
                                            취소
                                        </button>
                                        <button
                                            className="btn"
                                            onClick={handleDistribute}
                                            style={{
                                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                color: 'white',
                                                border: 'none'
                                            }}
                                        >
                                            반편성 시작
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 학생 배치 상세보기 모달 */}
                        {showStudentListModal && distributionPreview && (
                            <div style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0, 0, 0, 0.5)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 1000,
                                padding: '1rem'
                            }} onClick={() => setShowStudentListModal(false)}>
                                <div style={{
                                    background: 'white',
                                    padding: '2rem',
                                    borderRadius: '12px',
                                    maxWidth: '900px',
                                    width: '100%',
                                    maxHeight: '80vh',
                                    overflow: 'auto'
                                }} onClick={(e) => e.stopPropagation()}>
                                    <h2 style={{ marginTop: 0, color: '#667eea', marginBottom: '1.5rem' }}>
                                        📋 학생 배치 상세보기
                                    </h2>

                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                                        gap: '1rem',
                                        marginBottom: '1.5rem'
                                    }}>
                                        {distributionPreview.studentLists?.map((section: any) => (
                                            <div key={section.section} style={{
                                                border: '2px solid #e0e0e0',
                                                borderRadius: '8px',
                                                padding: '1rem',
                                                background: '#f9f9f9'
                                            }}>
                                                <h3 style={{
                                                    margin: '0 0 1rem 0',
                                                    color: '#667eea',
                                                    fontSize: '1.1rem',
                                                    borderBottom: '2px solid #667eea',
                                                    paddingBottom: '0.5rem'
                                                }}>
                                                    {section.section}반 ({section.students.length}명)
                                                </h3>
                                                <div style={{
                                                    maxHeight: '300px',
                                                    overflow: 'auto'
                                                }}>
                                                    {section.students.map((student: any, idx: number) => (
                                                        <div key={idx} style={{
                                                            padding: '0.5rem',
                                                            borderBottom: '1px solid #e0e0e0',
                                                            fontSize: '0.85rem',
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center'
                                                        }}>
                                                            <div style={{ flex: 1 }}>
                                                                <span style={{ fontWeight: 'bold' }}>{student.name}</span>
                                                                <span style={{ color: '#999', marginLeft: '0.5rem' }}>
                                                                    ({student.gender === 'M' ? '남' : '여'})
                                                                </span>
                                                                {student.previousSection && (
                                                                    <span style={{
                                                                        color: '#999',
                                                                        fontSize: '0.75rem',
                                                                        marginLeft: '0.5rem'
                                                                    }}>
                                                                        ← {student.previousSection}반
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                                                                {student.isProblem && (
                                                                    <span style={{
                                                                        background: '#ff6b6b',
                                                                        color: 'white',
                                                                        padding: '0.15rem 0.4rem',
                                                                        borderRadius: '4px',
                                                                        fontSize: '0.7rem'
                                                                    }}>문제</span>
                                                                )}
                                                                {student.isSpecial && (
                                                                    <span style={{
                                                                        background: '#4ecdc4',
                                                                        color: 'white',
                                                                        padding: '0.15rem 0.4rem',
                                                                        borderRadius: '4px',
                                                                        fontSize: '0.7rem'
                                                                    }}>특수</span>
                                                                )}
                                                                {student.group && (
                                                                    <span style={{
                                                                        background: '#667eea',
                                                                        color: 'white',
                                                                        padding: '0.15rem 0.4rem',
                                                                        borderRadius: '4px',
                                                                        fontSize: '0.7rem'
                                                                    }}>{student.group}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div style={{
                                        background: '#f0f0f0',
                                        padding: '1rem',
                                        borderRadius: '8px',
                                        marginBottom: '1rem'
                                    }}>
                                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#555' }}>
                                            반별 통계
                                        </h4>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                            gap: '0.5rem',
                                            fontSize: '0.85rem'
                                        }}>
                                            {distributionPreview.stats?.map((stat: any) => (
                                                <div key={stat.section} style={{ color: '#666' }}>
                                                    <strong>{stat.section}반:</strong> 총 {stat.total}명
                                                    (남 {stat.male}, 여 {stat.female}, 문제 {stat.problem}, 특수 {stat.special})
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setShowStudentListModal(false)}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            background: '#667eea',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontSize: '0.9rem',
                                            fontWeight: 'bold',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        닫기
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
