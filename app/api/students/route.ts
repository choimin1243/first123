import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const { students, classId, section } = await request.json();

        // 타입 검증
        if (!classId || !students || !Array.isArray(students)) {
            return NextResponse.json({
                error: 'Invalid request data. classId and students array are required.'
            }, { status: 400 });
        }

        // classId를 정수로 변환
        const classIdInt = parseInt(classId, 10);
        const sectionInt = parseInt(section || '1', 10);

        if (isNaN(classIdInt) || isNaN(sectionInt)) {
            return NextResponse.json({
                error: 'classId and section must be valid numbers.'
            }, { status: 400 });
        }

        // class가 존재하는지 확인
        const classCheck = db.prepare('SELECT id FROM classes WHERE id = ?').get(classIdInt);
        if (!classCheck) {
            return NextResponse.json({
                error: `Class with id ${classIdInt} does not exist.`
            }, { status: 404 });
        }

        const deleteStmt = db.prepare(
            'DELETE FROM students WHERE class_id = ? AND section_number = ?'
        );

        const insertStmt = db.prepare(
            'INSERT INTO students (class_id, section_number, name, gender, is_problem_student, group_name) VALUES (?, ?, ?, ?, ?, ?)'
        );

        const saveStudents = db.transaction((studentList: any[]) => {
            // 기존 학생 데이터 삭제
            deleteStmt.run(classIdInt, sectionInt);

            // 새로운 학생 데이터 삽입
            for (const student of studentList) {
                insertStmt.run(
                    classIdInt,
                    sectionInt,
                    student.name,
                    student.gender,
                    student.is_problem_student ? 1 : 0,
                    student.group_name || null
                );
            }
        });

        saveStudents(students);

        return NextResponse.json({ success: true, count: students.length });
    } catch (error) {
        console.error('Error creating students:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({
            error: 'Failed to create students',
            details: errorMessage
        }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const classId = searchParams.get('classId');
        const section = searchParams.get('section');

        if (!classId) {
            return NextResponse.json({ error: 'classId is required' }, { status: 400 });
        }

        let stmt;
        let students;

        if (section) {
            stmt = db.prepare('SELECT * FROM students WHERE class_id = ? AND section_number = ? ORDER BY id');
            students = stmt.all(classId, section);
        } else {
            stmt = db.prepare('SELECT * FROM students WHERE class_id = ? ORDER BY id');
            students = stmt.all(classId);
        }

        return NextResponse.json(students);
    } catch (error) {
        console.error('Error fetching students:', error);
        return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { id } = await request.json();

        const stmt = db.prepare('DELETE FROM students WHERE id = ?');
        stmt.run(id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting student:', error);
        return NextResponse.json({ error: 'Failed to delete student' }, { status: 500 });
    }
}
