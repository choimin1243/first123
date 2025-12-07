import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

interface Student {
    id: number;
    name: string;
    gender: 'M' | 'F';
    is_problem_student: number;
    is_special_class: number;
    group_name: string | null;
    rank: number | null;
}

export async function POST(request: NextRequest) {
    try {
        const { classId, newSectionCount, schoolId, preview, customDistribution } = await request.json();

        if (!classId || !newSectionCount || !schoolId) {
            return NextResponse.json({
                error: 'classId, newSectionCount, and schoolId are required'
            }, { status: 400 });
        }

        // 기존 클래스 정보 가져오기
        const classInfo: any = db.prepare('SELECT * FROM classes WHERE id = ? AND school_id = ?')
            .get(classId, schoolId);

        if (!classInfo) {
            return NextResponse.json({ error: 'Class not found' }, { status: 404 });
        }

        // 모든 반의 학생 가져오기 (반별로 그룹화)
        const allStudents: Student[] = db.prepare(
            'SELECT * FROM students WHERE class_id = ? ORDER BY section_number, gender, rank ASC, name'
        ).all(classId) as Student[];

        if (allStudents.length === 0) {
            return NextResponse.json({ error: 'No students found' }, { status: 400 });
        }

        // 특수반 학생과 일반 학생 분리
        const specialStudents = allStudents.filter(s => s.is_special_class === 1);
        const normalStudents = allStudents.filter(s => s.is_special_class === 0);

        // 반별로 그룹화
        const studentsBySection: { [key: number]: Student[] } = {};
        normalStudents.forEach(student => {
            const sectionNum = (student as any).section_number || 1;
            if (!studentsBySection[sectionNum]) {
                studentsBySection[sectionNum] = [];
            }
            studentsBySection[sectionNum].push(student);
        });

        // 반별 학생 배열 초기화
        const sections: Student[][] = Array.from({ length: newSectionCount }, () => []);

        // 성을 제외한 이름 추출 함수
        function getFirstName(fullName: string): string {
            if (fullName.length <= 1) return fullName;
            return fullName.substring(1);
        }

        // 특정 반에 학생을 배치할 수 있는지 확인
        function canPlaceStudent(student: Student, targetSection: number): { canPlace: boolean; reason?: string } {
            const sectionStudents = sections[targetSection];
            const studentFirstName = getFirstName(student.name);

            // 1. 그룹이 같으면 모두 다른 반에 배치
            if (student.group_name) {
                const sameGroupCount = sectionStudents.filter(
                    s => s.group_name === student.group_name
                ).length;
                if (sameGroupCount > 0) {
                    return { canPlace: false, reason: '같은 그룹 학생이 이미 있음' };
                }
            }

            // 2. 성을 제외한 이름이 같으면 다른 반에 배치
            const sameFirstNameCount = sectionStudents.filter(
                s => getFirstName(s.name) === studentFirstName
            ).length;
            if (sameFirstNameCount > 0) {
                return { canPlace: false, reason: '같은 이름(성을 제외) 학생이 이미 있음' };
            }

            return { canPlace: true };
        }

        // 가장 적은 학생 수를 가진 반 찾기
        function findMinSection(): number {
            const sectionCounts = sections.map(s => s.length);
            const minCount = Math.min(...sectionCounts);
            const minSections = sectionCounts
                .map((count, idx) => ({ count, idx }))
                .filter(item => item.count === minCount)
                .map(item => item.idx);
            return minSections[0];
        }

        // 등수 기반 라운드로빈 배치 로직으로 성적 벨런스 맞추기
        // 각 반에서 등수순으로 정렬된 학생들을 라운드로빈 패턴으로 배치
        const sectionNumbers = Object.keys(studentsBySection).map(Number).sort((a, b) => a - b);

        // 라운드로빈 배치 함수 (개선된 버전)
        function distributeRoundRobin(students: QueuedStudent[], startOffset: number = 0) {
            const pendingStudents: { student: QueuedStudent; preferredSection: number }[] = [];

            // 1차 배치: 라운드로빈 순서대로 배치 시도
            students.forEach((student, index) => {
                const preferredSection = (startOffset + index) % newSectionCount;
                const check = canPlaceStudent(student, preferredSection);

                if (check.canPlace) {
                    sections[preferredSection].push(student);
                } else {
                    // 배치 실패 시 대기열에 추가
                    pendingStudents.push({ student, preferredSection });
                }
            });

            // 2차 배치: 대기열의 학생들을 인원수가 적은 반부터 배치
            pendingStudents.forEach(({ student, preferredSection }) => {
                // 배치 가능한 반들 찾기
                const availableSections: number[] = [];
                for (let i = 0; i < newSectionCount; i++) {
                    if (canPlaceStudent(student, i).canPlace) {
                        availableSections.push(i);
                    }
                }

                let targetSection: number;
                if (availableSections.length > 0) {
                    // 배치 가능한 반들 중에서 선택 (인원수가 적고 선호 반에 가까운 반 우선)
                    targetSection = availableSections.reduce((best, current) => {
                        const currentCount = sections[current].length;
                        const bestCount = sections[best].length;

                        // 인원수가 더 적은 반 우선
                        if (currentCount < bestCount) return current;
                        if (currentCount > bestCount) return best;

                        // 인원수가 같으면 선호 반에 더 가까운 반 선택
                        const currentDist = Math.min(
                            Math.abs(current - preferredSection),
                            newSectionCount - Math.abs(current - preferredSection)
                        );
                        const bestDist = Math.min(
                            Math.abs(best - preferredSection),
                            newSectionCount - Math.abs(best - preferredSection)
                        );

                        return currentDist < bestDist ? current : best;
                    });
                } else {
                    // 모든 반이 제약 조건 위반이면 인원수가 가장 적은 반에 배치
                    targetSection = findMinSection();
                }

                sections[targetSection].push(student);
            });
        }

        // 각 반별로 학생 배치
        interface QueuedStudent extends Student {
            originalSection: number;
            rankOrder: number;
            isMale: boolean;
        }

        sectionNumbers.forEach((sectionNum, sectionIndex) => {
            const sectionStudents = studentsBySection[sectionNum];

            // 남학생 등수순 정렬
            const maleStudents: QueuedStudent[] = sectionStudents
                .filter(s => s.gender === 'M')
                .sort((a, b) => {
                    if (a.rank === null) return 1;
                    if (b.rank === null) return -1;
                    return a.rank - b.rank;
                })
                .map((s, idx) => ({
                    ...s,
                    originalSection: sectionNum,
                    rankOrder: idx + 1,
                    isMale: true
                }));

            // 여학생 등수순 정렬
            const femaleStudents: QueuedStudent[] = sectionStudents
                .filter(s => s.gender === 'F')
                .sort((a, b) => {
                    if (a.rank === null) return 1;
                    if (b.rank === null) return -1;
                    return a.rank - b.rank;
                })
                .map((s, idx) => ({
                    ...s,
                    originalSection: sectionNum,
                    rankOrder: idx + 1,
                    isMale: false
                }));

            // 각 반의 남자 1등과 여자 1등이 서로 다른 새로운 반에 배치되도록 offset 설정
            // 예: 1반 남1등→새1반, 1반 여1등→새2반, 2반 남1등→새2반, 2반 여1등→새3반...
            // 각 반의 1등들이 모두 다른 새로운 반에 분산되도록 설정

            // 남학생: 각 반마다 순차적으로 시작하되, 반 번호에 따라 다르게
            // 1반(sectionIndex=0) 남1등→새1반(0), 2반(sectionIndex=1) 남1등→새2반(1)...
            const maleOffset = sectionIndex % newSectionCount;

            // 여학생: 남학생보다 한 칸 뒤에서 시작
            // 1반(sectionIndex=0) 여1등→새2반(1), 2반(sectionIndex=1) 여1등→새3반(2)...
            const femaleOffset = (sectionIndex + 1) % newSectionCount;

            // 남학생 라운드로빈 배치
            distributeRoundRobin(maleStudents, maleOffset);

            // 여학생 라운드로빈 배치 (남학생과 다른 시작점)
            distributeRoundRobin(femaleStudents, femaleOffset);
        });

        // 등수가 없는 학생들은 마지막에 배치
        const studentsWithoutRank = normalStudents.filter(s => s.rank === null);
        studentsWithoutRank.forEach(s => {
            if (!sections.flat().find(placed => placed.id === s.id)) {
                const targetSection = findMinSection();
                sections[targetSection].push(s);
            }
        });

        // 두 학생을 교환할 수 있는지 확인
        function canSwapStudents(student1: Student, section1Idx: number, student2: Student, section2Idx: number): boolean {
            // student1을 section2에, student2를 section1에 배치 가능한지 확인
            const section1Copy = sections[section1Idx].filter(s => s.id !== student1.id);
            const section2Copy = sections[section2Idx].filter(s => s.id !== student2.id);

            // student2를 section1에 배치 가능한지 확인
            const student2FirstName = getFirstName(student2.name);
            if (student2.group_name && section1Copy.some(s => s.group_name === student2.group_name)) {
                return false;
            }
            if (section1Copy.some(s => getFirstName(s.name) === student2FirstName)) {
                return false;
            }

            // student1을 section2에 배치 가능한지 확인
            const student1FirstName = getFirstName(student1.name);
            if (student1.group_name && section2Copy.some(s => s.group_name === student1.group_name)) {
                return false;
            }
            if (section2Copy.some(s => getFirstName(s.name) === student1FirstName)) {
                return false;
            }

            return true;
        }

        // 학생수 균등화를 위한 재균형 (스왑 로직 포함)
        function rebalanceStudentCount() {
            for (let attempt = 0; attempt < 50; attempt++) {
                const sectionCounts = sections.map(s => s.length);
                const maxCount = Math.max(...sectionCounts);
                const minCount = Math.min(...sectionCounts);

                // 학생 수 차이가 1 이하면 완료
                if (maxCount - minCount <= 1) break;

                const maxSectionIndex = sectionCounts.indexOf(maxCount);
                const minSectionIndex = sectionCounts.indexOf(minCount);

                if (maxSectionIndex === minSectionIndex) break;

                const maxSection = sections[maxSectionIndex];
                const minSection = sections[minSectionIndex];

                let moved = false;

                // 1. 직접 이동 시도
                for (let i = maxSection.length - 1; i >= 0; i--) {
                    const student = maxSection[i];
                    const check = canPlaceStudent(student, minSectionIndex);

                    if (check.canPlace) {
                        maxSection.splice(i, 1);
                        minSection.push(student);
                        moved = true;
                        break;
                    }
                }

                // 2. 직접 이동 실패 시 스왑 시도
                if (!moved) {
                    for (let i = 0; i < maxSection.length; i++) {
                        for (let j = 0; j < minSection.length; j++) {
                            if (canSwapStudents(maxSection[i], maxSectionIndex, minSection[j], minSectionIndex)) {
                                const temp = maxSection[i];
                                maxSection[i] = minSection[j];
                                minSection[j] = temp;
                                moved = true;
                                break;
                            }
                        }
                        if (moved) break;
                    }
                }

                if (!moved) break; // 더 이상 조정 불가능
            }
        }

        // 남녀비율 균등화를 위한 재균형 (스왑 로직 포함)
        function rebalanceGenderRatio() {
            for (let attempt = 0; attempt < 50; attempt++) {
                const genderStats = sections.map(section => {
                    const male = section.filter(s => s.gender === 'M').length;
                    const female = section.filter(s => s.gender === 'F').length;
                    const total = section.length;
                    return { male, female, total, ratio: total > 0 ? male / total : 0 };
                });

                const avgRatio = genderStats.reduce((sum, s) => sum + s.ratio, 0) / genderStats.length;
                const maxDiff = Math.max(...genderStats.map(s => Math.abs(s.ratio - avgRatio)));

                // 남녀비율 차이가 작으면 완료
                if (maxDiff < 0.15) break;

                // 비율이 가장 높은 반과 가장 낮은 반 찾기
                let maxRatioIndex = 0;
                let minRatioIndex = 0;
                for (let i = 1; i < genderStats.length; i++) {
                    if (genderStats[i].ratio > genderStats[maxRatioIndex].ratio) maxRatioIndex = i;
                    if (genderStats[i].ratio < genderStats[minRatioIndex].ratio) minRatioIndex = i;
                }

                if (maxRatioIndex === minRatioIndex) break;

                const maxSection = sections[maxRatioIndex];
                const minSection = sections[minRatioIndex];
                const targetGender = genderStats[maxRatioIndex].ratio > avgRatio ? 'M' : 'F';
                const oppositeGender = targetGender === 'M' ? 'F' : 'M';

                let moved = false;

                // 1. 직접 이동 시도
                for (let i = maxSection.length - 1; i >= 0; i--) {
                    const student = maxSection[i];
                    if (student.gender === targetGender) {
                        const check = canPlaceStudent(student, minRatioIndex);
                        if (check.canPlace) {
                            maxSection.splice(i, 1);
                            minSection.push(student);
                            moved = true;
                            break;
                        }
                    }
                }

                // 2. 직접 이동 실패 시 스왑 시도 (같은 성별끼리 또는 반대 성별끼리)
                if (!moved) {
                    // 같은 성별끼리 스왑 시도
                    for (let i = 0; i < maxSection.length; i++) {
                        if (maxSection[i].gender !== targetGender) continue;
                        for (let j = 0; j < minSection.length; j++) {
                            if (minSection[j].gender !== targetGender) continue;
                            if (canSwapStudents(maxSection[i], maxRatioIndex, minSection[j], minRatioIndex)) {
                                const temp = maxSection[i];
                                maxSection[i] = minSection[j];
                                minSection[j] = temp;
                                moved = true;
                                break;
                            }
                        }
                        if (moved) break;
                    }
                }

                // 3. 반대 성별끼리 스왑 시도 (비율 개선에 더 효과적)
                if (!moved) {
                    for (let i = 0; i < maxSection.length; i++) {
                        if (maxSection[i].gender !== targetGender) continue;
                        for (let j = 0; j < minSection.length; j++) {
                            if (minSection[j].gender !== oppositeGender) continue;
                            if (canSwapStudents(maxSection[i], maxRatioIndex, minSection[j], minRatioIndex)) {
                                const temp = maxSection[i];
                                maxSection[i] = minSection[j];
                                minSection[j] = temp;
                                moved = true;
                                break;
                            }
                        }
                        if (moved) break;
                    }
                }

                if (!moved) break; // 더 이상 조정 불가능
            }
        }

        // 재균형 실행 (여러 번 반복하여 최적화)
        for (let balanceRound = 0; balanceRound < 3; balanceRound++) {
            rebalanceStudentCount();
            rebalanceGenderRatio();
            // 남녀비율 조정으로 인해 학생수 불균형이 생길 수 있으므로 다시 학생수 균등화
            rebalanceStudentCount();
        }

        // 특수아이는 마지막에 인원수가 적은 반에 배치
        specialStudents.forEach(student => {
            const sectionCounts = sections.map(s => s.length);
            const minCount = Math.min(...sectionCounts);
            const minSections = sectionCounts
                .map((count, idx) => ({ count, idx }))
                .filter(item => item.count === minCount)
                .map(item => item.idx);
            const targetSection = minSections[0];
            sections[targetSection].push(student);
        });

        // 사용자 지정 배치가 있으면 사용
        if (customDistribution && !preview) {
            // customDistribution을 sections 형식으로 변환
            const customSections: Student[][] = Array.from({ length: newSectionCount }, () => []);
            const usedStudentIds = new Set<number>();
            
            customDistribution.forEach((dist: any) => {
                const sectionIndex = dist.section - 1;
                if (sectionIndex >= 0 && sectionIndex < newSectionCount) {
                    // 원본 학생 데이터 찾기
                    dist.students.forEach((customStudent: any) => {
                        // 이름, 성별, 이전 반 번호로 학생 찾기
                        const originalStudent = allStudents.find(s => {
                            if (usedStudentIds.has(s.id)) return false;
                            const matches = s.name === customStudent.name && 
                                          s.gender === customStudent.gender;
                            // previous_section이 있으면 그것도 확인
                            if (customStudent.previous_section) {
                                return matches && (s as any).section_number === customStudent.previous_section;
                            }
                            return matches;
                        });
                        if (originalStudent) {
                            customSections[sectionIndex].push(originalStudent);
                            usedStudentIds.add(originalStudent.id);
                        }
                    });
                }
            });
            
            // 사용되지 않은 학생들도 추가 (혹시 누락된 경우)
            allStudents.forEach(student => {
                if (!usedStudentIds.has(student.id)) {
                    // 가장 적은 반에 추가
                    const sectionCounts = customSections.map(s => s.length);
                    const minCount = Math.min(...sectionCounts);
                    const targetSection = sectionCounts.indexOf(minCount);
                    customSections[targetSection].push(student);
                }
            });
            
            sections.splice(0, sections.length, ...customSections);
        }

        // 통계 계산 함수
        function calculateStats(sections: Student[][]) {
            return sections.map((students, index) => {
                const validRanks = students
                    .filter(s => s.rank !== null && s.is_special_class === 0)
                    .map(s => s.rank!);
                
                const avgRank = validRanks.length > 0 
                    ? Math.round((validRanks.reduce((a, b) => a + b, 0) / validRanks.length) * 10) / 10
                    : null;
                
                // 등수 분산 계산 (벨런스 확인용)
                const variance = validRanks.length > 1
                    ? validRanks.reduce((sum, rank) => {
                        const diff = rank - (avgRank || 0);
                        return sum + diff * diff;
                    }, 0) / validRanks.length
                    : 0;
                
                const stdDev = Math.round(Math.sqrt(variance) * 10) / 10;

                return {
                    section: index + 1,
                    total: students.length,
                    male: students.filter(s => s.gender === 'M').length,
                    female: students.filter(s => s.gender === 'F').length,
                    problem: students.filter(s => s.is_problem_student === 1).length,
                    special: students.filter(s => s.is_special_class === 1).length,
                    avgRank,
                    stdDev,
                    students: students.map(s => ({
                        name: s.name,
                        gender: s.gender,
                        is_problem_student: s.is_problem_student,
                        is_special_class: s.is_special_class,
                        group_name: s.group_name,
                        rank: s.rank,
                        previous_section: (s as any).section_number
                    }))
                };
            });
        }

        // 미리보기 모드면 DB 저장 없이 통계만 반환
        if (preview) {
            const stats = calculateStats(sections);

            return NextResponse.json({
                success: true,
                stats,
                message: '미리보기 데이터'
            });
        }

        // 새로운 클래스 생성 (반편성 표시 및 원본 클래스 ID 저장)
        const insertClass = db.prepare(
            'INSERT INTO classes (school_id, grade, section_count, is_distributed, parent_class_id) VALUES (?, ?, ?, ?, ?)'
        );
        const result = insertClass.run(schoolId, classInfo.grade, newSectionCount, 1, classId);
        const newClassId = result.lastInsertRowid;

        // 학생들을 새 클래스에 배치 (이전 반 번호 저장)
        const insertStudent = db.prepare(
            `INSERT INTO students (class_id, section_number, name, gender, is_problem_student, is_special_class, group_name, rank, previous_section)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );

        const insertAllStudents = db.transaction(() => {
            sections.forEach((sectionStudents, sectionIndex) => {
                sectionStudents.forEach(student => {
                    insertStudent.run(
                        newClassId,
                        sectionIndex + 1,
                        student.name,
                        student.gender,
                        student.is_problem_student,
                        student.is_special_class,
                        student.group_name,
                        student.rank,
                        (student as any).section_number // 원래 반 번호를 이전 반으로 저장
                    );
                });
            });
        });

        insertAllStudents();

        // 기존 클래스의 학생 데이터는 보존 (참고용으로 유지)
        // 기존 클래스에 child_class_id 설정하여 연결
        const updateParentClass = db.prepare(
            'UPDATE classes SET child_class_id = ? WHERE id = ? AND school_id = ?'
        );
        updateParentClass.run(newClassId, classId, schoolId);

        // 반별 통계 및 학생 명단 생성
        const stats = calculateStats(sections);

        // 각 반별 학생 명단 (이름만)
        const studentLists = sections.map((students, index) => ({
            section: index + 1,
            students: students.map(s => ({
                name: s.name,
                gender: s.gender,
                isProblem: s.is_problem_student === 1,
                isSpecial: s.is_special_class === 1,
                group: s.group_name,
                previousSection: (s as any).section_number
            }))
        }));

        return NextResponse.json({
            success: true,
            newClassId,
            stats,
            studentLists,
            message: `${newSectionCount}개 반으로 편성 완료`
        });

    } catch (error) {
        console.error('Error distributing students:', error);
        return NextResponse.json({
            error: 'Failed to distribute students',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
