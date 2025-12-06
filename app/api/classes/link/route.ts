import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const { parentClassId, childClassId, schoolId } = await request.json();

        if (!parentClassId || !childClassId || !schoolId) {
            return NextResponse.json({
                error: 'parentClassId, childClassId, and schoolId are required'
            }, { status: 400 });
        }

        // Verify that both classes exist and belong to the school
        const parentClass: any = db.prepare(
            'SELECT * FROM classes WHERE id = ? AND school_id = ?'
        ).get(parentClassId, schoolId);

        const childClass: any = db.prepare(
            'SELECT * FROM classes WHERE id = ? AND school_id = ?'
        ).get(childClassId, schoolId);

        if (!parentClass || !childClass) {
            return NextResponse.json({
                error: 'One or both classes not found'
            }, { status: 404 });
        }

        // Update the parent class to link to the child class
        db.prepare(
            'UPDATE classes SET child_class_id = ? WHERE id = ? AND school_id = ?'
        ).run(childClassId, parentClassId, schoolId);

        return NextResponse.json({
            success: true,
            message: 'Classes linked successfully'
        });

    } catch (error) {
        console.error('Error linking classes:', error);
        return NextResponse.json({
            error: 'Failed to link classes',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
