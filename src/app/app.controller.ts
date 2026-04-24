// =========================================================================>> Core Library
import { Controller, Get, Render } from '@nestjs/common';

// ======================================= >> Code Starts Here << ========================== //
@Controller()
export class AppController {
    @Get()
    @Render('index')
    root() {
        return { title: 'Club54 Coffee Shop POS API' };
    }
}
